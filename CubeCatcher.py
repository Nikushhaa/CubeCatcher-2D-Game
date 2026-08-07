import random
import sys
import math
import pygame
import datetime
import json
import os

pygame.init()

# ---------------------------------------------------------
# Constants
# ---------------------------------------------------------
WIDTH, HEIGHT = 800, 600
FPS = 60
BG_COLOR = (8, 8, 20)

WHITE = (255, 255, 255)
RED = (220, 60, 60)
GREEN = (60, 200, 100)
YELLOW = (230, 210, 60)
BLUE = (60, 110, 220)
PURPLE = (170, 70, 200)
CYAN = (80, 220, 220)
ORANGE = (240, 150, 60)
GRAY = (60, 60, 60)

# Colors used only for the player ship's detailed silhouette
HULL_COLOR = (198, 208, 225)
HULL_OUTLINE = (90, 100, 120)
WING_COLOR = (170, 180, 200)
COCKPIT_COLOR = (50, 70, 100)
COCKPIT_GLOW = (120, 200, 255)

# Enemy definitions: health, speed range, color, size, score value, movement pattern
ENEMY_TYPES = {
    "scout": {
        "health": 1,
        "min_speed": 120,
        "max_speed": 180,
        "color": RED,
        "size": 28,
        "score": 10,
        "pattern": "straight"
    },
    "zigzag": {
        "health": 2,
        "min_speed": 90,
        "max_speed": 140,
        "color": BLUE,
        "size": 32,
        "score": 20,
        "pattern": "zigzag"
    },
    "tank": {
        "health": 5,
        "min_speed": 50,
        "max_speed": 80,
        "color": PURPLE,
        "size": 46,
        "score": 40,
        "pattern": "straight"
    }
}

# Power-up definitions. "duration" is 0 for instant effects like extra_life.
POWERUP_TYPES = {
    "fire_rate": {"color": YELLOW, "label": "F", "duration": 8.0},
    "triple_shot": {"color": CYAN, "label": "T", "duration": 8.0},
    "shield": {"color": BLUE, "label": "S", "duration": 10.0},
    "extra_life": {"color": GREEN, "label": "+", "duration": 0.0},
    "big_bullets": {"color": ORANGE, "label": "B", "duration": 8.0}
}

DATA_FILE = "space_shooter_players.json"

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Space Shooter")
clock = pygame.time.Clock()


# ---------------------------------------------------------
# Player data persistence (same schema/approach as Cube Catcher)
# ---------------------------------------------------------
def load_players():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {}


def save_players():
    with open(DATA_FILE, "w") as f:
        json.dump(players, f, indent=4)


players = load_players()


def get_day():
    days = [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday"
    ]
    return days[datetime.datetime.today().weekday()]


def create_player(name):
    if name not in players:
        players[name] = {
            "games": 0,
            "best_score": 0,
            "total_score": 0,
            "daily": {},
            "weekly": {
                "Monday": 0, "Tuesday": 0, "Wednesday": 0,
                "Thursday": 0, "Friday": 0, "Saturday": 0, "Sunday": 0
            }
        }
        save_players()
    return players[name]


def update_player(name, score):
    player = players[name]
    today = str(datetime.date.today())
    day = get_day()

    player["games"] += 1
    player["total_score"] += score

    if score > player["best_score"]:
        player["best_score"] = score

    if today not in player["daily"]:
        player["daily"][today] = 0
    if score > player["daily"][today]:
        player["daily"][today] = score

    if score > player["weekly"][day]:
        player["weekly"][day] = score

    save_players()


# ---------------------------------------------------------
# Small helpers
# ---------------------------------------------------------
def clamp(value, min_value, max_value):
    return max(min_value, min(value, max_value))


def draw_text(text, x, y, size=34, color=WHITE, center=True, surface=None):
    target = surface if surface is not None else screen
    img = pygame.font.SysFont(None, size).render(text, True, color)
    if center:
        target.blit(img, (int(x - img.get_width() / 2), int(y)))
    else:
        target.blit(img, (int(x), int(y)))


# ---------------------------------------------------------
# Background stars
# ---------------------------------------------------------
class Star:
    """A single background star that slowly drifts downward."""

    def __init__(self):
        self.x = random.uniform(0, WIDTH)
        self.y = random.uniform(0, HEIGHT)
        self.speed = random.uniform(20, 80)
        self.size = random.choice([1, 1, 2])
        self.brightness = random.randint(120, 255)

    def update(self, dt):
        self.y += self.speed * dt
        if self.y > HEIGHT:
            self.y = 0
            self.x = random.uniform(0, WIDTH)

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        c = (self.brightness, self.brightness, self.brightness)
        pygame.draw.circle(target, c, (int(self.x), int(self.y)), self.size)


# ---------------------------------------------------------
# Bullets
# ---------------------------------------------------------
class Bullet:
    """A projectile fired by the player. vx lets triple-shot bullets angle out."""

    def __init__(self, x, y, vx=0, big=False):
        self.width = 8 if not big else 14
        self.height = 18 if not big else 26
        self.x = x - self.width / 2
        self.y = y
        self.vx = vx
        self.vy = -520
        self.big = big
        self.color = ORANGE if big else CYAN

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt

    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.width, self.height)

    def is_offscreen(self):
        return self.y + self.height < 0 or self.x < -20 or self.x > WIDTH + 20

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        pygame.draw.rect(target, self.color, self.rect(), border_radius=3)


# ---------------------------------------------------------
# Player
# ---------------------------------------------------------
class Player:
    """The player's spaceship, including health, lives and power-up timers."""

    # An original ship silhouette made of a handful of polygons, defined as
    # fractions of (width, height) with the nose pointing up (fy=0 is the top).
    HULL_POINTS = [
        (0.50, 0.00), (0.62, 0.20), (0.72, 0.42), (0.60, 0.62),
        (0.62, 0.92), (0.50, 1.00), (0.38, 0.92), (0.40, 0.62),
        (0.28, 0.42), (0.38, 0.20)
    ]
    STRIPE_POINTS = [
        (0.50, 0.06), (0.55, 0.40), (0.53, 0.88), (0.47, 0.88), (0.45, 0.40)
    ]
    WING_LEFT_POINTS = [(0.30, 0.40), (0.00, 0.64), (0.30, 0.78), (0.40, 0.62)]
    WING_RIGHT_POINTS = [(0.70, 0.40), (1.00, 0.64), (0.70, 0.78), (0.60, 0.62)]
    COCKPIT_RECT = (0.40, 0.14, 0.20, 0.22)  # fx, fy, fw, fh (fractions)

    def __init__(self):
        self.width = 48
        self.height = 56
        self.x = WIDTH / 2 - self.width / 2
        self.y = HEIGHT - self.height - 20
        self.speed = 380

        self.max_health = 100
        self.health = 100
        self.lives = 3

        self.base_fire_delay = 0.35
        self.fire_timer = 0.0

        self.fire_rate_timer = 0.0
        self.triple_shot_timer = 0.0
        self.shield_timer = 0.0
        self.big_bullets_timer = 0.0

        self.engine_time = 0.0  # used to animate the pulsing engine glow

    def move(self, dt, keys):
        if keys[pygame.K_a]:
            self.x -= self.speed * dt
        if keys[pygame.K_d]:
            self.x += self.speed * dt
        self.x = clamp(self.x, 0, WIDTH - self.width)

    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.width, self.height)

    def update_timers(self, dt):
        self.fire_timer -= dt
        self.fire_rate_timer = max(0.0, self.fire_rate_timer - dt)
        self.triple_shot_timer = max(0.0, self.triple_shot_timer - dt)
        self.shield_timer = max(0.0, self.shield_timer - dt)
        self.big_bullets_timer = max(0.0, self.big_bullets_timer - dt)
        self.engine_time += dt

    def has_shield(self):
        return self.shield_timer > 0

    def can_shoot(self):
        return self.fire_timer <= 0

    def get_fire_delay(self):
        if self.fire_rate_timer > 0:
            return self.base_fire_delay * 0.4
        return self.base_fire_delay

    def shoot(self):
        """Returns a list of new Bullet objects based on active power-ups."""
        self.fire_timer = self.get_fire_delay()
        cx = self.x + self.width / 2
        big = self.big_bullets_timer > 0

        if self.triple_shot_timer > 0:
            return [
                Bullet(cx, self.y, vx=-160, big=big),
                Bullet(cx, self.y, vx=0, big=big),
                Bullet(cx, self.y, vx=160, big=big)
            ]
        return [Bullet(cx, self.y, vx=0, big=big)]

    def take_damage(self, amount):
        """Returns True if the hit actually landed (i.e. no shield absorbed it)."""
        if self.has_shield():
            return False
        self.health -= amount
        return True

    def apply_powerup(self, name):
        info = POWERUP_TYPES[name]
        if name == "extra_life":
            self.lives += 1
        elif name == "shield":
            self.shield_timer = info["duration"]
            self.health = min(self.max_health, self.health + 20)
        else:
            setattr(self, name + "_timer", info["duration"])

    def to_px(self, fx, fy):
        """Converts a fractional (fx, fy) point into actual screen pixels."""
        return (self.x + fx * self.width, self.y + fy * self.height)

    def hull_polygon(self, points):
        return [self.to_px(fx, fy) for fx, fy in points]

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        self.draw_engine_glow(target)
        self.draw_wings(target)
        self.draw_hull(target)
        self.draw_cockpit(target)
        self.draw_nav_lights(target)
        if self.has_shield():
            self.draw_shield_ring(target)

    def draw_engine_glow(self, target):
        # A pulsing thruster flame behind the ship, driven by engine_time
        flicker = 0.6 + 0.4 * abs(math.sin(self.engine_time * 14))
        cx, cy = self.to_px(0.5, 1.02)
        outer_r = max(1, int(self.width * 0.22 * flicker))
        inner_r = max(1, int(outer_r * 0.5))
        pygame.draw.circle(target, ORANGE, (int(cx), int(cy)), outer_r)
        pygame.draw.circle(target, YELLOW, (int(cx), int(cy)), inner_r)

    def draw_wings(self, target):
        for points in (self.WING_LEFT_POINTS, self.WING_RIGHT_POINTS):
            wing = self.hull_polygon(points)
            pygame.draw.polygon(target, WING_COLOR, wing)
            pygame.draw.polygon(target, HULL_OUTLINE, wing, 2)

    def draw_hull(self, target):
        hull = self.hull_polygon(self.HULL_POINTS)
        pygame.draw.polygon(target, HULL_COLOR, hull)
        pygame.draw.polygon(target, HULL_OUTLINE, hull, 2)

        stripe = self.hull_polygon(self.STRIPE_POINTS)
        stripe_color = WHITE if self.has_shield() else CYAN
        pygame.draw.polygon(target, stripe_color, stripe)

    def draw_cockpit(self, target):
        fx, fy, fw, fh = self.COCKPIT_RECT
        rect = pygame.Rect(
            int(self.x + fx * self.width),
            int(self.y + fy * self.height),
            int(fw * self.width),
            int(fh * self.height)
        )
        pygame.draw.ellipse(target, COCKPIT_COLOR, rect)
        pygame.draw.ellipse(target, COCKPIT_GLOW, rect, 2)

    def draw_nav_lights(self, target):
        # Small red/green navigation lights, aviation-style, on the wingtips
        left = self.to_px(0.30, 0.66)
        right = self.to_px(0.70, 0.66)
        pygame.draw.circle(target, RED, (int(left[0]), int(left[1])), 3)
        pygame.draw.circle(target, GREEN, (int(right[0]), int(right[1])), 3)

    def draw_shield_ring(self, target):
        cx, cy = self.to_px(0.5, 0.55)
        pygame.draw.circle(target, CYAN, (int(cx), int(cy)), int(self.width * 0.9), 2)


# ---------------------------------------------------------
# Enemies
# ---------------------------------------------------------
class Enemy:
    """An enemy ship falling from the top of the screen."""

    def __init__(self, type_name, difficulty):
        info = ENEMY_TYPES[type_name]
        self.type_name = type_name
        self.size = info["size"]
        self.color = info["color"]
        self.score_value = info["score"]
        self.pattern = info["pattern"]

        self.health = info["health"]
        self.max_health = info["health"]

        speed = random.uniform(info["min_speed"], info["max_speed"])
        self.speed = speed * difficulty

        self.x = random.uniform(0, WIDTH - self.size)
        self.y = -self.size

        self.zigzag_dir = random.choice([-1, 1])
        self.zigzag_speed = random.uniform(60, 120)

    def update(self, dt):
        self.y += self.speed * dt

        if self.pattern == "zigzag":
            self.x += self.zigzag_dir * self.zigzag_speed * dt
            if self.x <= 0 or self.x >= WIDTH - self.size:
                self.zigzag_dir *= -1
                self.x = clamp(self.x, 0, WIDTH - self.size)

    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.size, self.size)

    def is_offscreen(self):
        return self.y > HEIGHT

    def take_damage(self, amount):
        """Returns True if this hit destroyed the enemy."""
        self.health -= amount
        return self.health <= 0

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        pygame.draw.rect(target, self.color, self.rect(), border_radius=4)

        # Tougher enemies show a small health bar above them
        if self.max_health > 1:
            ratio = max(0, self.health / self.max_health)
            pygame.draw.rect(target, GRAY, (self.x, self.y - 8, self.size, 4))
            pygame.draw.rect(target, GREEN, (self.x, self.y - 8, self.size * ratio, 4))


# ---------------------------------------------------------
# Explosions
# ---------------------------------------------------------
class Explosion:
    """A short-lived particle burst used for enemy hits and destructions."""

    def __init__(self, x, y, color):
        self.particles = []
        count = random.randint(10, 16)
        for _ in range(count):
            angle = random.uniform(0, math.tau)
            speed = random.uniform(60, 220)
            self.particles.append({
                "x": x, "y": y,
                "vx": math.cos(angle) * speed,
                "vy": math.sin(angle) * speed,
                "life": random.uniform(0.3, 0.6),
                "color": color
            })

    def update(self, dt):
        for p in self.particles:
            p["x"] += p["vx"] * dt
            p["y"] += p["vy"] * dt
            p["life"] -= dt
        self.particles = [p for p in self.particles if p["life"] > 0]

    def is_finished(self):
        return len(self.particles) == 0

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        for p in self.particles:
            size = max(1, int(p["life"] * 6))
            pygame.draw.circle(target, p["color"], (int(p["x"]), int(p["y"])), size)


# ---------------------------------------------------------
# Power-ups
# ---------------------------------------------------------
class PowerUp:
    """A collectible drop that grants the player a temporary bonus."""

    def __init__(self):
        self.type_name = random.choice(list(POWERUP_TYPES.keys()))
        info = POWERUP_TYPES[self.type_name]
        self.color = info["color"]
        self.label = info["label"]
        self.size = 26
        self.x = random.uniform(0, WIDTH - self.size)
        self.y = -self.size
        self.speed = 140

    def update(self, dt):
        self.y += self.speed * dt

    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.size, self.size)

    def is_offscreen(self):
        return self.y > HEIGHT

    def draw(self, surface=None):
        target = surface if surface is not None else screen
        pygame.draw.rect(target, self.color, self.rect(), border_radius=6)
        draw_text(self.label, self.x + self.size / 2, self.y + 3, size=22, surface=target)


# ---------------------------------------------------------
# Game
# ---------------------------------------------------------
class Game:
    """Owns all game state, handles updates/collisions/drawing, and runs the loop."""

    def __init__(self, name):
        self.name = name
        self.player = Player()
        self.bullets = []
        self.enemies = []
        self.powerups = []
        self.explosions = []
        self.stars = [Star() for _ in range(80)]

        self.score = 0
        self.high_score = players[name]["best_score"]

        self.elapsed = 0.0
        self.spawn_timer = 0.0

        self.shake_timer = 0.0
        self.shake_strength = 0

        self.running = True

    # -- Difficulty --------------------------------------
    def difficulty_multiplier(self):
        # Enemies get faster the longer the game runs, capped at 2.5x speed
        return 1.0 + min(self.elapsed / 60.0, 1.5)

    def current_spawn_interval(self):
        # Enemies spawn more often over time, but never faster than every 0.45s
        return max(0.45, 1.4 - self.elapsed * 0.01)

    def pick_enemy_type(self):
        weights = {"scout": 5, "zigzag": 2, "tank": 1}
        if self.elapsed > 20:
            weights["zigzag"] += 2
        if self.elapsed > 40:
            weights["tank"] += 2
        names = list(weights.keys())
        chances = list(weights.values())
        return random.choices(names, weights=chances)[0]

    # -- Spawning ------------------------------------------
    def spawn_enemy(self):
        type_name = self.pick_enemy_type()
        self.enemies.append(Enemy(type_name, self.difficulty_multiplier()))

    def maybe_spawn_powerup(self, x, y):
        if random.random() < 0.15:
            p = PowerUp()
            p.x = x
            p.y = y
            self.powerups.append(p)

    def trigger_shake(self, strength=8, duration=0.25):
        self.shake_strength = strength
        self.shake_timer = duration

    # -- Update ----------------------------------------------
    def update(self, dt, keys):
        self.elapsed += dt
        self.player.move(dt, keys)
        self.player.update_timers(dt)

        if keys[pygame.K_SPACE] and self.player.can_shoot():
            self.bullets.extend(self.player.shoot())

        self.spawn_timer += dt
        if self.spawn_timer >= self.current_spawn_interval():
            self.spawn_timer = 0
            self.spawn_enemy()

        self.update_bullets(dt)
        self.update_enemies(dt)
        self.update_powerups(dt)
        self.update_explosions(dt)
        self.update_shake_and_stars(dt)
        self.check_collisions()

        self.high_score = max(self.high_score, self.score)
        self.check_player_death()

    def update_bullets(self, dt):
        for b in self.bullets:
            b.update(dt)
        self.bullets = [b for b in self.bullets if not b.is_offscreen()]

    def update_enemies(self, dt):
        for e in self.enemies:
            e.update(dt)
        self.enemies = [e for e in self.enemies if not e.is_offscreen()]

    def update_powerups(self, dt):
        for p in self.powerups:
            p.update(dt)
        self.powerups = [p for p in self.powerups if not p.is_offscreen()]

    def update_explosions(self, dt):
        for ex in self.explosions:
            ex.update(dt)
        self.explosions = [ex for ex in self.explosions if not ex.is_finished()]

    def update_shake_and_stars(self, dt):
        if self.shake_timer > 0:
            self.shake_timer -= dt
        for s in self.stars:
            s.update(dt)

    def check_player_death(self):
        if self.player.health <= 0:
            self.player.lives -= 1
            if self.player.lives > 0:
                # Respawn with full health and a brief grace-period shield
                self.player.health = self.player.max_health
                self.player.shield_timer = 2.0
            else:
                self.running = False

    # -- Collisions --------------------------------------------
    def check_collisions(self):
        self.check_bullet_enemy_collisions()
        self.check_player_enemy_collisions()
        self.check_player_powerup_collisions()

    def check_bullet_enemy_collisions(self):
        for bullet in self.bullets[:]:
            for enemy in self.enemies[:]:
                if bullet.rect().colliderect(enemy.rect()):
                    damage = 2 if bullet.big else 1
                    destroyed = enemy.take_damage(damage)

                    if bullet in self.bullets:
                        self.bullets.remove(bullet)

                    if destroyed:
                        self.enemies.remove(enemy)
                        self.score += enemy.score_value
                        self.explosions.append(Explosion(
                            enemy.x + enemy.size / 2,
                            enemy.y + enemy.size / 2,
                            enemy.color
                        ))
                        self.maybe_spawn_powerup(enemy.x, enemy.y)
                    break

    def check_player_enemy_collisions(self):
        prect = self.player.rect()
        for enemy in self.enemies[:]:
            if prect.colliderect(enemy.rect()):
                self.enemies.remove(enemy)
                self.explosions.append(Explosion(
                    enemy.x + enemy.size / 2,
                    enemy.y + enemy.size / 2,
                    enemy.color
                ))
                if self.player.take_damage(25):
                    self.trigger_shake()

    def check_player_powerup_collisions(self):
        prect = self.player.rect()
        for p in self.powerups[:]:
            if prect.colliderect(p.rect()):
                self.powerups.remove(p)
                self.player.apply_powerup(p.type_name)

    # -- Drawing -------------------------------------------------
    def get_shake_offset(self):
        if self.shake_timer <= 0:
            return 0, 0
        return (
            random.randint(-self.shake_strength, self.shake_strength),
            random.randint(-self.shake_strength, self.shake_strength)
        )

    def draw(self):
        # Draw the game world onto its own surface so it can be shaken as one piece
        world = pygame.Surface((WIDTH, HEIGHT))
        world.fill(BG_COLOR)

        for s in self.stars:
            s.draw(world)
        for p in self.powerups:
            p.draw(world)
        for e in self.enemies:
            e.draw(world)
        for b in self.bullets:
            b.draw(world)
        for ex in self.explosions:
            ex.draw(world)
        self.player.draw(world)

        ox, oy = self.get_shake_offset()
        screen.fill(BG_COLOR)
        screen.blit(world, (ox, oy))

        self.draw_hud()

    def draw_hud(self):
        draw_text("Score: " + str(self.score), 90, 15, size=28, center=False)
        draw_text("High Score: " + str(self.high_score), WIDTH - 220, 15, size=28, center=False)
        draw_text("Lives: " + str(self.player.lives), 90, 48, size=22, center=False)

        # Health bar
        bar_w = 200
        ratio = max(0, self.player.health / self.player.max_health)
        pygame.draw.rect(screen, GRAY, (WIDTH / 2 - bar_w / 2, 15, bar_w, 16))
        pygame.draw.rect(screen, GREEN, (WIDTH / 2 - bar_w / 2, 15, bar_w * ratio, 16))
        draw_text("HEALTH", WIDTH / 2, 33, size=16)

        # Active power-up indicators
        active = []
        if self.player.fire_rate_timer > 0:
            active.append("Fire Rate")
        if self.player.triple_shot_timer > 0:
            active.append("Triple Shot")
        if self.player.shield_timer > 0:
            active.append("Shield")
        if self.player.big_bullets_timer > 0:
            active.append("Big Bullets")
        if active:
            draw_text(" | ".join(active), WIDTH / 2, HEIGHT - 30, size=20)

    # -- Main loop -----------------------------------------------
    def run(self):
        while self.running:
            dt = clock.tick(FPS) / 1000
            keys = pygame.key.get_pressed()

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()

            self.update(dt, keys)
            self.draw()
            pygame.display.flip()

        return self.score


# ---------------------------------------------------------
# Screens
# ---------------------------------------------------------
def username_screen():
    name = ""
    active = True

    while active:
        screen.fill(BG_COLOR)
        draw_text("SPACE SHOOTER", WIDTH // 2, 120, size=50)
        draw_text("Enter Username", WIDTH // 2, 220, size=30)
        draw_text(name + "_", WIDTH // 2, 280, size=36)
        draw_text("Press ENTER", WIDTH // 2, 380, size=24)
        pygame.display.flip()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    if name != "":
                        active = False
                elif event.key == pygame.K_BACKSPACE:
                    name = name[:-1]
                else:
                    if len(name) < 15:
                        name += event.unicode
    return name


def game_over_screen(name, score):
    update_player(name, score)
    data = players[name]
    today = str(datetime.date.today())
    active = True

    while active:
        screen.fill(BG_COLOR)
        draw_text("GAME OVER", WIDTH // 2, 60, size=50)
        draw_text("Player: " + name, WIDTH // 2, 140, size=28)
        draw_text("Score: " + str(score), WIDTH // 2, 180, size=28)
        draw_text("Best Score: " + str(data["best_score"]), WIDTH // 2, 220, size=28)
        draw_text("Games Played: " + str(data["games"]), WIDTH // 2, 260, size=28)
        draw_text("Today's Best: " + str(data["daily"][today]), WIDTH // 2, 300, size=28)
        draw_text("This Week's Best: " + str(data["weekly"][get_day()]), WIDTH // 2, 340, size=28)
        draw_text("Press ENTER to Exit", WIDTH // 2, 450, size=24)
        pygame.display.flip()

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                active = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_RETURN:
                    active = False


# ---------------------------------------------------------
# Entry point
# ---------------------------------------------------------
player_name = username_screen()
create_player(player_name)

game = Game(player_name)
final_score = game.run()

game_over_screen(player_name, final_score)

pygame.quit()
sys.exit()
import random
import sys
import pygame

# ვრთავთ pygame-ს
pygame.init()

# თამაშის ზომები
WIDTH, HEIGHT = 800, 600

# რამდენი კადრი იქნება წამში
FPS = 60

# ფონის ფერი
BG_COLOR = (20, 20, 20)

# ფერების სია
COLORS = {
    "RED": (220, 60, 60),
    "BLUE": (60, 110, 220),
    "GREEN": (60, 200, 100),
    "YELLOW": (230, 210, 60),
    "PURPLE": (170, 70, 200),
}

# ვქმნით თამაშის ფანჯარას
screen = pygame.display.set_mode((WIDTH, HEIGHT))

# ვარქმევთ თამაშს სახელს
pygame.display.set_caption("Cube Catcher")

# საათი, რომელიც აკონტროლებს სიჩქარეს
clock = pygame.time.Clock()

# ტექსტის ზომა
font = pygame.font.SysFont(None, 48)


# ---------------- მოთამაშის კლასი ----------------
class Player:

    # ეს მუშაობს მაშინ, როცა მოთამაშეს ვქმნით
    def __init__(self):

        # მოთამაშის ზომა
        self.width = 90
        self.height = 30

        # მოთამაშის საწყისი ადგილი
        self.x = WIDTH / 2 - self.width / 2
        self.y = HEIGHT - self.height - 20

        # რამდენად სწრაფად მოძრაობს
        self.speed = 400

        # მოთამაშეს შემთხვევით ვაძლევთ ფერს
        self.color = random.choice(list(COLORS.keys()))


    # მოთამაშის მოძრაობა
    def move(self, dt):

        # ვამოწმებთ რომელი ღილაკი არის დაჭერილი
        keys = pygame.key.get_pressed()

        # თუ A-ს დავაჭერთ, მარცხნივ წავა
        if keys[pygame.K_a]:
            self.x -= self.speed * dt

        # თუ D-ს დავაჭერთ, მარჯვნივ წავა
        if keys[pygame.K_d]:
            self.x += self.speed * dt


        # არ მივცეთ საშუალება ეკრანიდან გავიდეს
        self.x = max(0, min(self.x, WIDTH - self.width))


    # ქმნის მართკუთხედს შეჯახების შესამოწმებლად
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.width, self.height)


    # ხატავს მოთამაშეს ეკრანზე
    def draw(self):
        pygame.draw.rect(screen, COLORS[self.color], self.rect())



# ---------------- კუბის კლასი ----------------
class Cube:

    # როცა ახალ კუბს ვქმნით
    def __init__(self):

        # კუბის ზომა
        self.size = 30

        # შემთხვევითი ადგილი ზემოდან
        self.x = random.randint(0, WIDTH - self.size)

        # იწყებს ეკრანის ზემოდან
        self.y = -self.size

        # შემთხვევითი სიჩქარე
        self.speed = random.randint(180, 300)

        # კუბს ვაძლევთ შემთხვევით ფერს
        self.color = random.choice(list(COLORS.keys()))


    # კუბის ჩამოვარდნა
    def fall(self, dt):

        # კუბი ქვემოთ მოძრაობს
        self.y += self.speed * dt


    # კუბის ადგილი შეჯახებისთვის
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.size, self.size)


    # კუბის დახატვა
    def draw(self):
        pygame.draw.rect(screen, COLORS[self.color], self.rect())



# ---------------- თამაშის მონაცემები ----------------

# ვქმნით მოთამაშეს
player = Player()

# აქ შევინახავთ ყველა კუბს
cubes = []

# ქულა თავიდან არის 0
score = 0

# დრო, რომელიც ითვლის კუბების გამოჩენას
spawn_timer = 0

# რამდენ წამში გაჩნდება ახალი კუბი
spawn_interval = random.uniform(0.5, 1.0)

# თამაში ჩართულია
running = True



# ---------------- მთავარი თამაშის ციკლი ----------------

# სანამ თამაში მუშაობს
while running:

    # ვიგებთ რამდენი დრო გავიდა წინა კადრიდან
    dt = clock.tick(FPS) / 1000


    # ვამოწმებთ მოვლენებს
    for event in pygame.event.get():

        # თუ X ღილაკს დავაჭერთ, თამაში დაიხურება
        if event.type == pygame.QUIT:
            running = False



    # ვამოძრავებთ მოთამაშეს
    player.move(dt)



    # -------- ახალი კუბების შექმნა --------

    # დროს ვზრდით
    spawn_timer += dt


    # თუ საკმარისი დრო გავიდა
    if spawn_timer >= spawn_interval:

        # დროს თავიდან ვიწყებთ
        spawn_timer = 0

        # შემდეგი კუბი როდის გაჩნდება
        spawn_interval = random.uniform(0.5, 1.0)

        # ვქმნით ახალ კუბს
        cubes.append(Cube())



    # -------- კუბების მოძრაობა და შეჯახებები --------

    # ვამოწმებთ ყველა კუბს
    for cube in cubes[:]:

        # კუბი ჩამოდის ქვემოთ
        cube.fall(dt)


        # თუ კუბი მოთამაშეს შეეხო
        if cube.rect().colliderect(player.rect()):


            # თუ ფერები ერთნაირია
            if cube.color == player.color:

                # კუბს ვშლით
                cubes.remove(cube)

                # ქულას ვამატებთ
                score += 1

                # მოთამაშეს ახალი ფერი ეძლევა
                player.color = random.choice(list(COLORS.keys()))


            # თუ ფერები განსხვავებულია
            else:

                # თამაში მთავრდება
                running = False


            continue



        # თუ კუბი ეკრანს გასცდა
        if cube.y > HEIGHT:

            # ვშლით
            cubes.remove(cube)



    # -------- ხატვა --------

    # ვასუფთავებთ ეკრანს
    screen.fill(BG_COLOR)


    # ვხატავთ მოთამაშეს
    player.draw()


    # ვხატავთ ყველა კუბს
    for cube in cubes:
        cube.draw()



    # ვქმნით ქულის ტექსტს
    score_text = font.render(str(score), True, (255, 255, 255))


    # ვაჩვენებთ ქულას ეკრანზე
    screen.blit(score_text, score_text.get_rect(center=(WIDTH // 2, 40)))


    # ეკრანს ვაახლებთ
    pygame.display.flip()



# თამაშის დახურვა
pygame.quit()

# პროგრამის დასრულება
sys.exit()
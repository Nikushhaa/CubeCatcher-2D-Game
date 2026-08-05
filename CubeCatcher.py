import random
import sys
import pygame
import datetime
import json
import os

pygame.init()

WIDTH,HEIGHT=800,600
FPS=60
BG_COLOR=(20,20,20)

COLORS={
"RED":(220,60,60),
"BLUE":(60,110,220),
"GREEN":(60,200,100),
"YELLOW":(230,210,60),
"PURPLE":(170,70,200)
}

screen=pygame.display.set_mode((WIDTH,HEIGHT))
pygame.display.set_caption("Cube Catcher")
clock=pygame.time.Clock()

font=pygame.font.SysFont(None,48)
small_font=pygame.font.SysFont(None,30)

DATA_FILE="players.json"

def load_players():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE,"r") as f:
            return json.load(f)
    return {}

def save_players():
    with open(DATA_FILE,"w") as f:
        json.dump(players,f,indent=4)

players=load_players()

def get_day():
    days=[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ]
    return days[datetime.datetime.today().weekday()]

def create_player(name):
    if name not in players:
        players[name]={
            "games":0,
            "best_score":0,
            "total_score":0,
            "daily":{},
            "weekly":{
                "Monday":0,
                "Tuesday":0,
                "Wednesday":0,
                "Thursday":0,
                "Friday":0,
                "Saturday":0,
                "Sunday":0
            }
        }
        save_players()
    return players[name]

def update_player(name,score):
    player=players[name]
    today=str(datetime.date.today())
    day=get_day()

    player["games"]+=1
    player["total_score"]+=score

    if score>player["best_score"]:
        player["best_score"]=score

    if today not in player["daily"]:
        player["daily"][today]=0

    if score>player["daily"][today]:
        player["daily"][today]=score

    if score>player["weekly"][day]:
        player["weekly"][day]=score

    save_players()

def draw_text(text,x,y,size=48):
    img=pygame.font.SysFont(None,size).render(
        text,
        True,
        (255,255,255)
    )
    screen.blit(
        img,
        (x-img.get_width()//2,y)
    )

class Player:
    def __init__(self):
        self.width=90
        self.height=30
        self.x=WIDTH/2-self.width/2
        self.y=HEIGHT-self.height-20
        self.speed=400
        self.color=random.choice(list(COLORS.keys()))

    def move(self,dt):
        keys=pygame.key.get_pressed()

        if keys[pygame.K_a]:
            self.x-=self.speed*dt

        if keys[pygame.K_d]:
            self.x+=self.speed*dt

        self.x=max(
            0,
            min(
                self.x,
                WIDTH-self.width
            )
        )

    def rect(self):
        return pygame.Rect(
            int(self.x),
            int(self.y),
            self.width,
            self.height
        )

    def draw(self):
        pygame.draw.rect(
            screen,
            COLORS[self.color],
            self.rect()
        )

class Cube:
    def __init__(self):
        self.size=30
        self.x=random.randint(0,WIDTH-self.size)
        self.y=-self.size
        self.speed=random.randint(180,300)
        self.color=random.choice(list(COLORS.keys()))

    def fall(self,dt):
        self.y+=self.speed*dt

    def rect(self):
        return pygame.Rect(
            int(self.x),
            int(self.y),
            self.size,
            self.size
        )

    def draw(self):
        pygame.draw.rect(
            screen,
            COLORS[self.color],
            self.rect()
        )


def username_screen():
    name=""
    active=True

    while active:
        screen.fill(BG_COLOR)

        draw_text(
            "Enter Username",
            WIDTH//2,
            150
        )

        draw_text(
            name+"_",
            WIDTH//2,
            240
        )

        draw_text(
            "Press ENTER",
            WIDTH//2,
            340,
            30
        )
        pygame.display.flip()

        for event in pygame.event.get():

            if event.type==pygame.QUIT:
                pygame.quit()
                sys.exit()

            if event.type==pygame.KEYDOWN:

                if event.key==pygame.K_RETURN:

                    if name!="":
                        active=False

                elif event.key==pygame.K_BACKSPACE:
                    name=name[:-1]

                else:

                    if len(name)<15:
                        name+=event.unicode
    return name


def game_over_screen(name,score):

    update_player(name,score)

    data=players[name]

    active=True

    while active:

        screen.fill(BG_COLOR)

        draw_text(
            "GAME OVER",
            WIDTH//2,
            70
        )

        draw_text(
            "Player: "+name,
            WIDTH//2,
            140,
            30
        )

        draw_text(
            "Score: "+str(score),
            WIDTH//2,
            190,
            30
        )

        draw_text(
            "Best: "+str(data["best_score"]),
            WIDTH//2,
            240,
            30
        )

        draw_text(
            "Games: "+str(data["games"]),
            WIDTH//2,
            290,
            30
        )

        draw_text(
            "Today: "+get_day(),
            WIDTH//2,
            340,
            30
        )

        draw_text(
            "Press ENTER",
            WIDTH//2,
            450,
            30
        )

        pygame.display.flip()


        for event in pygame.event.get():

            if event.type==pygame.QUIT:
                active=False

            if event.type==pygame.KEYDOWN:

                if event.key==pygame.K_RETURN:
                    active=False



player_name=username_screen()

create_player(player_name)

player=Player()

cubes=[]

score=0

spawn_timer=0

spawn_interval=random.uniform(0.5,1.0)

running=True


while running:

    dt=clock.tick(FPS)/1000


    for event in pygame.event.get():

        if event.type==pygame.QUIT:
            running=False


    player.move(dt)


    spawn_timer+=dt


    if spawn_timer>=spawn_interval:

        spawn_timer=0

        spawn_interval=random.uniform(0.5,1.0)

        cubes.append(Cube())


    for cube in cubes[:]:

        cube.fall(dt)


        if cube.rect().colliderect(player.rect()):

            if cube.color==player.color:

                cubes.remove(cube)

                score+=1

                player.color=random.choice(
                    list(COLORS.keys())
                )

            else:

                running=False

            continue


        if cube.y>HEIGHT:

            if cube.color==player.color:
                score-=1

            cubes.remove(cube)



    screen.fill(BG_COLOR)

    player.draw()

    for cube in cubes:
        cube.draw()


    draw_text(
        str(score),
        WIDTH//2,
        20
    )

    draw_text(
        "Player: "+player_name,
        120,
        20,
        25
    )


    pygame.display.flip()



game_over_screen(
    player_name,
    score
)


pygame.quit()
sys.exit()
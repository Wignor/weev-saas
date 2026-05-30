# -*- coding: utf-8 -*-
import psycopg2

msg = "Olá, {nome}?! \U0001f44b\nSeja muito bem-vindo(a) à *WeevTrack.*\n\nPara que eu possa te atender da melhor forma, me conta rapidinho:\n\nVocê já é nosso cliente ou está chegando agora para conhecer nossos serviços?\n\nResponda com uma das opções abaixo:\n\n\U0001f449 - *JÁ SOU CLIENTE*\n\U0001f449 - *QUERO CONHECER*"

conn = psycopg2.connect('postgresql://postgres:deusehfiel@localhost:5432/weevbot')
cur = conn.cursor()
cur.execute("UPDATE settings SET value = %s WHERE key = 'welcome_message'", (msg,))
if cur.rowcount == 0:
    cur.execute("INSERT INTO settings (key, value) VALUES ('welcome_message', %s)", (msg,))
conn.commit()
cur.execute("SELECT value FROM settings WHERE key = 'welcome_message'")
row = cur.fetchone()
print('SAVED OK, first 80 chars:', row[0][:80])
conn.close()

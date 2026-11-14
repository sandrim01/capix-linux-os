import cv2, numpy as np, sys
src = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)  # 624x807 BGRA (3x)
out = sys.argv[2]
H, W = src.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
def poly(pts):
    m = np.zeros((H, W), np.uint8); cv2.fillPoly(m, [np.array(pts, np.int32)], 255); return m
head = poly([(150,250),(160,200),(195,168),(258,140),(266,100),(300,90),(325,124),(400,118),(420,116),(468,126),(484,170),(466,205),(468,262),(462,320),(420,352),(330,372),(250,356),(195,345),(160,305)])
head = cv2.dilate(head, np.ones((9,9),np.uint8))
cup  = poly([(82,440),(90,423),(108,420),(110,396),(130,388),(222,393),(232,412),(255,415),(262,440),(262,478),(240,490),(210,492),(200,507),(130,508),(118,490),(100,478),(84,468)])
alpha = src[:,:,3].astype(np.float32)

# --- cabeça: borda suave só no corte do pescoço ---
hm = head.astype(np.float32)/255
hm = np.where(yy > 290, cv2.GaussianBlur(head,(0,0),4).astype(np.float32)/255, hm)
head_rgba = src.copy(); head_rgba[:,:,3] = (alpha*hm).astype(np.uint8)
cup_rgba = src.copy(); cup_rgba[:,:,3] = (alpha*cv2.GaussianBlur(cup,(0,0),1).astype(np.float32)/255).astype(np.uint8)

# --- corpo: original; sob a cabeça mantém só o que é tronco; sob a xícara, clona pelo da barriga ---
body_zone = np.zeros((H,W),np.uint8)
cv2.ellipse(body_zone,(330,560),(205,330),0,0,360,255,-1)
body_zone[yy < 250] = 0
body_zone[(xx < 142) & (yy > 380) & (yy < 530)] = 0
base = src.copy()
a = alpha.copy()
# cabeça fora do tronco -> transparente (suave)
outside = ((head > 0) & (body_zone == 0)).astype(np.float32)
a = a * (1 - cv2.GaussianBlur(outside,(0,0),2.5))
# xícara: clona pelo da barriga (deslocamento até uma área lisa)
cupd = cv2.dilate(cup, np.ones((11,11),np.uint8))
DX, DY = 210, 175
clone = np.roll(np.roll(src, -DY, axis=0), -DX, axis=1)
w = cv2.GaussianBlur(cupd,(0,0),4).astype(np.float32)/255
inside = body_zone > 0
for c in range(3):
    base[:,:,c] = np.where(inside, src[:,:,c]*(1-w) + clone[:,:,c]*w, src[:,:,c]).astype(np.uint8)
a = np.where(inside, np.maximum(a, 255*w), a*(1-w))
# sob a cabeça (parte do tronco): troca focinho/boca/bochecha por pelo, para não "vazar" quando a cabeça mexe
hz = ((head > 0) & inside).astype(np.uint8)*255
wh = cv2.GaussianBlur(cv2.erode(hz, np.ones((15,15),np.uint8)),(0,0),6).astype(np.float32)/255
clone2 = np.roll(src, -300, axis=0)
for c in range(3):
    base[:,:,c] = (base[:,:,c]*(1-wh) + clone2[:,:,c]*wh).astype(np.uint8)
base[:,:,3] = np.clip(a,0,255).astype(np.uint8)
cv2.imwrite(out+'-base.png', base); cv2.imwrite(out+'-head.png', head_rgba); cv2.imwrite(out+'-cup.png', cup_rgba)
print('ok')

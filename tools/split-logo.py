#!/usr/bin/env python3
"""
Recorta a logo original (sem redesenhar) em camadas para a animação de boot:
  logo-base.png  logo com olhos apagados (fundo branco) e boca escura sob o queixo
  logo-chin.png  queixo (mandíbula) — sobe e desce na mastigada
  logo-eyeL.png / logo-eyeR.png  olhos — piscam
Uso: python3 tools/split-logo.py art/logo-original.jpg art/
"""
import cv2, numpy as np, json, sys, os
src = cv2.imread(sys.argv[1]); outdir = sys.argv[2]
CROP = (600, 400, 1450, 1640)       # x0, y0, x1, y1 no original 2048x2048
SCALE = 0.5
H, W = src.shape[:2]
yy, xx = np.mgrid[0:H, 0:W]
f = src.astype(np.int32)
ink = np.clip((765 - f.sum(2)) / 90.0, 0, 1)            # "tinta" (não-branco), com antisserrilhado
dark = np.linalg.norm(f - np.array([46, 62, 90]), axis=2) < 70  # marrom-escuro dos olhos/contornos

def rect(x0, y0, x1, y1): return (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
eyeL = cv2.dilate((dark & rect(755, 675, 872, 768) & (ink > 0.35)).astype(np.uint8), np.ones((5,5),np.uint8)) > 0
eyeR = cv2.dilate((dark & rect(1176, 684, 1292, 768) & (ink > 0.35)).astype(np.uint8), np.ones((5,5),np.uint8)) > 0
chin = rect(905, 1203, 1147, 1268) & (ink > 0.35)
chin = cv2.morphologyEx(chin.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5,5),np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(chin)
chin = lab == (1 + np.argmax(st[1:, cv2.CC_STAT_AREA]))      # só o queixo (maior pedaço)
chin = cv2.dilate(chin.astype(np.uint8), np.ones((5,5),np.uint8)) > 0

layers = {}
def rgba(mask, alpha):
    a = (alpha * mask).astype(np.float32)
    return np.dstack([src, (a * 255).astype(np.uint8)])

base = np.dstack([src.copy(), np.full((H, W), 255, np.uint8)])
orange = (f[:,:,2] > 190) & (f[:,:,1] > 90) & (f[:,:,1] < 190) & (f[:,:,0] < 110)
for m in (eyeL, eyeR):
    base[:,:,:3][m & ~orange] = 255                       # olho some -> fundo branco
base[:,:,:3][chin & (ink > 0.35)] = (24, 30, 44)          # interior da boca (BGR)
layers['base'] = base
layers['chin'] = rgba(chin, ink)
layers['eyeL'] = rgba(eyeL, np.maximum(ink, 0))
layers['eyeR'] = rgba(eyeR, np.maximum(ink, 0))

x0, y0, x1, y1 = CROP
boxes = {}
for k, im in layers.items():
    im = im[y0:y1, x0:x1]
    im = cv2.resize(im, None, fx=SCALE, fy=SCALE, interpolation=cv2.INTER_AREA)
    if k != 'base':
        ys, xs = np.where(im[:,:,3] > 0)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        im = im[by0:by1, bx0:bx1]
        boxes[k] = [int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)]
    else:
        boxes[k] = [0, 0, im.shape[1], im.shape[0]]
    cv2.imwrite(os.path.join(outdir, f'logo-{k}.png'), im, [cv2.IMWRITE_PNG_COMPRESSION, 9])
json.dump(boxes, open(os.path.join(outdir, 'logo-layers.json'), 'w'))
print(boxes)

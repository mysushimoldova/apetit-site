"""Заставки категорий: из роликов Kling делает ролики для сайта.

  assets/splash-video/<категория>/<slug>.mp4  →  public/splash/<slug>.mp4

Что делает с каждым роликом:
  1. обрезает по продукту (общая рамка по всем кадрам + 5 % поля), длинная сторона 720 px;
  2. убирает фон и тень: маску считает нейросеть выделения объекта (ISNet, ai_matte.py),
     покадрово, с временным сглаживанием; внутри силуэта продукт всегда сплошной;
  3. поднимает до 60 к/с и вшивает разгон-замедление (быстро в начале, медленно в конце),
     итог ровно 1.5 с = 90 кадров;
  4. все ролики крутятся в одну сторону: у кого направление «не то» — время идёт назад
     (не зеркало: надписи на бутылках не страдают);
  5. кадр = цвет сверху + маска снизу (высота двойная), h264 crf 26;
  6. внизу слева цветной половины — чёрный и белый квадраты 16×16 (калибровка диапазона в шейдере).

Запуск:  py -3 scripts/splash-video/make.py            (все ролики, готовые пропускает)
         py -3 scripts/splash-video/make.py kebab-cheese cola   (только эти)
         py -3 scripts/splash-video/make.py --force ...          (пересобрать)
Нужно: ffmpeg/ffprobe в PATH; pip: numpy opencv-python scipy onnxruntime;
модель assets/models/isnet-general-use.onnx (178 МБ, не в git) — скачать один раз:
https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx
Один ролик — около 6 минут на обычном процессоре.
Настройки в config.json: skip (сколько первых кадров выбросить), reverse (список slug).
"""
import json, subprocess, os, sys, shutil, tempfile, glob
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(__file__))
from ai_matte import predict, finish
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "assets", "splash-video")
OUT = os.path.join(ROOT, "public", "splash")
CFG = json.load(open(os.path.join(os.path.dirname(__file__), "config.json"), encoding="utf-8"))
OUT_N, SLOW, FPS_SRC = 90, 0.8, 24

def run(cmd): subprocess.run(cmd, check=True)

def crop_box(src, skip):
    d = tempfile.mkdtemp()
    run(["ffmpeg","-v","error","-y","-i",src,"-vf",f"select='gte(n\\,{skip})*not(mod(n\\,6))',scale=iw/4:ih/4","-vsync","0",f"{d}/f%03d.png"])
    mask = None
    for f in sorted(os.listdir(d)):
        a = cv2.imread(f"{d}/{f}").astype(int)
        m = np.abs(a-255).sum(2) > 36
        mask = m if mask is None else (mask | m)
    shutil.rmtree(d)
    ys, xs = np.where(mask); H, W = mask.shape
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    mw = int((x1-x0)*0.05)+2; mh = int((y1-y0)*0.05)+2
    x0 = max(0,x0-mw); x1 = min(W-1,x1+mw); y0 = max(0,y0-mh); y1 = min(H-1,y1+mh)
    return int(x0*4), int(y0*4), int((x1-x0+1)*4), int((y1-y0+1)*4)

def timemap(D):
    fast, slowv = 1+SLOW*1.6, 1-SLOW*0.8
    ps = (np.arange(OUT_N)+0.5)/OUT_N
    r = slowv + (fast-slowv)*(1-ps)**2.2
    c = np.concatenate([[0], np.cumsum(r)]); c = c/c[-1]
    return c[:-1]*D

def build(src, slug, force=False):
    out = os.path.join(OUT, f"{slug}.mp4")
    if os.path.exists(out) and not force:
        print(f"{slug:26s} есть, пропускаю"); return
    skip = CFG.get("skip", {}).get(slug, 0)
    x, y, w, h = crop_box(src, skip)
    d = tempfile.mkdtemp(); os.makedirs(f"{d}/o"); os.makedirs(f"{d}/s")
    run(["ffmpeg","-v","error","-y","-i",src,"-vf",
         f"select='gte(n\\,{skip})',setpts=N/{FPS_SRC}/TB,crop={w}:{h}:{x}:{y},scale='if(gt(iw,ih),720,-2)':'if(gt(iw,ih),-2,720)'",
         "-vsync","0",f"{d}/f%03d.png"])
    fs = sorted(f for f in os.listdir(d) if f.endswith(".png"))
    ims = [cv2.imread(f"{d}/{f}") for f in fs]
    als = [predict(im) for im in ims]
    for i, (f, im) in enumerate(zip(fs, ims)):
        st = [als[j] for j in (i-1, i, i+1) if 0 <= j < len(als)]       # сглаживание по времени
        al = np.median(np.stack(st), axis=0).astype(np.float32)
        col, al = finish(im, al)   # сплошной силуэт, чуть поджатый край, цвета продолжены наружу, эталоны
        cv2.imwrite(f"{d}/o/{f}", np.vstack([col, np.repeat((al*255).astype(np.uint8)[...,None],3,2)]))
    D = (len(fs)-1)/FPS_SRC
    run(["ffmpeg","-v","error","-y","-framerate",str(FPS_SRC),"-i",f"{d}/o/f%03d.png","-vf",
         "minterpolate=fps=120:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1","-vsync","0",f"{d}/i%04d.png"])
    inter = sorted(f for f in os.listdir(d) if f.startswith("i")); M = len(inter)
    ts = timemap(D)
    if slug in CFG.get("reverse", []): ts = D-ts
    for k, t in enumerate(ts):
        shutil.copy(f"{d}/{inter[max(0,min(M-1,int(round(t*120))))]}", f"{d}/s/f{k:03d}.png")
    os.makedirs(OUT, exist_ok=True)
    run(["ffmpeg","-v","error","-y","-framerate","60","-i",f"{d}/s/f%03d.png","-vf","format=yuv420p",
         "-an","-c:v","libx264","-preset","slow","-crf","26","-movflags","+faststart",out])
    shutil.rmtree(d)
    print(f"{slug:26s} {os.path.getsize(out)//1024} KB")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]; force = "--force" in sys.argv
    files = sorted(glob.glob(os.path.join(SRC, "*", "*.mp4")))
    for f in files:
        slug = os.path.splitext(os.path.basename(f))[0]
        if args and slug not in args: continue
        build(f, slug, force)

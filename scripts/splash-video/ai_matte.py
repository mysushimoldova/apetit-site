import numpy as np, cv2, onnxruntime as ort
_sess=None
def sess():
    global _sess
    if _sess is None:
        so=ort.SessionOptions(); so.intra_op_num_threads=2
        import os
        p=os.path.join(os.path.dirname(__file__),"..","..","assets","models","isnet-general-use.onnx")
        _sess=ort.InferenceSession(p,so,providers=["CPUExecutionProvider"])
    return _sess
def predict(im_bgr):
    """ISNet-general-use: 1024x1024 input, returns alpha 0..1 at source size."""
    h,w=im_bgr.shape[:2]
    rgb=cv2.cvtColor(im_bgr,cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    x=cv2.resize(rgb,(1024,1024),interpolation=cv2.INTER_AREA)
    x=(x-0.5)/1.0
    x=x.transpose(2,0,1)[None]
    s=sess(); out=s.run(None,{s.get_inputs()[0].name:x})[0][0][0]
    out=(out-out.min())/max(1e-6,out.max()-out.min())
    return cv2.resize(out.astype(np.float32),(w,h),interpolation=cv2.INTER_LINEAR)

from scipy import ndimage
def finish(im, al):
    """Маска → готовый кадр: сплошной силуэт (внутри всегда 1), край поджат на ~1px,
    цвета продолжены наружу от ядра (нет белой каймы), эталоны калибровки внизу слева."""
    sil=ndimage.binary_fill_holes(al>0.3); l,k=ndimage.label(sil)
    if k>1:
        s=ndimage.sum(sil,l,range(1,k+1)); sil=l==(np.argmax(s)+1)
    al=np.where(sil,al,0.0).astype(np.float32)
    al=np.clip((al-0.08)/0.84,0,1)
    dt=cv2.distanceTransform(sil.astype(np.uint8),cv2.DIST_L2,5)
    al=np.where(dt>3.0,1.0,al).astype(np.float32)
    al=np.minimum(al,np.clip((dt-0.5)/1.2,0,1)).astype(np.float32)
    al=cv2.GaussianBlur(al,(0,0),0.5)
    core=dt>=2.0
    idx=ndimage.distance_transform_edt(~core,return_distances=False,return_indices=True)
    col=np.where(core[...,None],im,im[idx[0],idx[1]]).astype(np.uint8)
    col[-16:,0:16]=0; col[-16:,16:32]=255
    return col,al

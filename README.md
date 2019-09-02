# YUV to RGB on CocosCreator 2.1.2

記錄如何將websocket直播影像yuv值透過cocosCreator2.1.2的Material和Effect傳入shader運算轉換成rgb值呈現在texture上來降低draw calls。

## 什麼是yuv，什麼是rgb?

yuv簡單說就是亮度(y)和色度(uv)，沒有了uv，一樣可以顯示黑白影像，兼容於黑白影像和彩色影像。

有關yuv細節請參考網路。

rgb就是三色值(red，green，blue)。

## 為什麼yuv要轉換成rgb?

因為想直接在texture上render出影像，而不是用影像播放器，這樣的做法是為了增加效能(降低draw calls)。

## HOW to do?

首先要說明，因為以javascript為基底的cocosCreator已經全面改版為Material和Effect，所有對Texture的效果呈現(模糊，閃光，etc..)，都可以透過掛在Sprite上的Material材質球來呈現，Material上則掛載Effect來運算出效果。
Effect其實就是Shader，以Opengl語言來開發。

這邊基本的做法就是，將從Websocket取得的直播影像訊息buffer，拆解成yuv三個Uint8Array，然後透過Webgl轉換成三張GLTexture，再送入Effect Shader中換算成rgb值呈現出來。

1. 拆解影像訊息成yuv

```javascript
this.yData = this.player.video.instance.heapU8.subarray(
    ptrY,
    ptrY + this.player.video.codedSize
);
this.vData = this.player.video.instance.heapU8.subarray(
    ptrCr,
    ptrCr + (this.player.video.codedSize >> 2)
);
this.uData = this.player.video.instance.heapU8.subarray(
    ptrCb,
    ptrCb + (this.player.video.codedSize >> 2)
);
```

2. 透過Webgl轉換成GLTexture
```javascript
this.yTex = this.gl.createTexture();
this.uTex = this.gl.createTexture();
this.vTex = this.gl.createTexture();
.
.
.
this.setGLTexture(1, this.yTex, this.renderWidth, this.renderHeight, this.yData);
this.setGLTexture(2, this.uTex, this.renderWidth/2, this.renderHeight/2,this.uData);
this.setGLTexture(3, this.vTex, this.renderWidth/2, this.renderHeight/2,this.vData);
.
.
.
setGLTexture(index, texture, width, height, data) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0+index);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, data);
},
```



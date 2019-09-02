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

2. 透過Webgl轉換成GLTexture，並傳送每次更新後的yuv GLTexture進Effect Shader裡
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
// 在setGLTexture中，就已經activeTexture，將已經gl.createTexture的GLTexture轉送到該sprite的material的effect裡(如果有設定的話)
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
3. Effect取得yuv GLTexture，轉換成rgb後呈現

這邊要說明一下effect裡的程式結構，下面的techniques和passes，是shader的呈現方式。
vert和frag就是接下來會用到的頂點和碎片運算，理解的想法應該是先在vert(vs)取得頂點資訊，然後傳入frag(fs)針對各頂點運算相關rgb值，最後呈現出每個碎片的顏色。
而properties是預設會有的參數，設定好後可以直接從編輯器上設定。
```
%{
  techniques: [
    {
      passes: [
        {
          vert: vs
          frag: fs
          cullMode: none
          blend: true
        }
      ]
      layer: 0
    }
  ]
  properties: {
    texture: {
      type: sampler2D
      value: null
    }
  }
%}

```
接著是vs，頂點運算，這裡理解成Effect Shader會取得這個Sprite的位置和頂點矩陣，這邊直接用原本的範例程式來取得Sprite的頂點資訊。
- uniform: 代表從外部傳入的參數
- attribute: 應該代表內部取得的參數(a_position位置，a_uv0貼圖uv位置)
- varying: 冠有這個前綴字的參數代表等下要傳入fs運算

```
%% vs {

precision highp float;

uniform mat4 cc_matViewProj;
attribute vec3 a_position;

#if USE_TEXTURE
  attribute mediump vec2 a_uv0;
  varying mediump vec2 v_uv0;
#endif

void main () {
  mat4 mvp;
  mvp = cc_matViewProj;

  #if USE_TEXTURE
    v_uv0 = a_uv0;
  #endif

  gl_Position = mvp * vec4(a_position, 1);
}

}
```
從vs取得頂點資訊，傳入fs運算，這裡還有從外部傳入的三張yuv的貼圖，接著針對yuv和頂點資訊，代入yuv換算成rgb的公式，算出每個碎片的rgb色值。
- uniform sampler2D ySampler，uSampler，vSampler: 就是在Webgl算好的yuv三張貼圖，要指定index(gl.TEXTURE0+index)傳入
- varying mediump vec2 v_uv0: 從vs傳來的頂點資訊
```
%% fs {

precision highp float;

#if USE_TEXTURE
  uniform sampler2D texture;
  uniform sampler2D ySampler;
  uniform sampler2D uSampler;
  uniform sampler2D vSampler;
  varying mediump vec2 v_uv0;
#endif

void main () {
  vec4 c = vec4((texture2D(ySampler, v_uv0).r - 16./255.) * 1.164);
	vec4 U = vec4(texture2D(uSampler, v_uv0).r - 128./255.);
	vec4 V = vec4(texture2D(vSampler, v_uv0).r - 128./255.);
	c += V * vec4(1.596, -0.813, 0, 0);
	c += U * vec4(0, -0.392, 2.017, 0);
	c.a = 1.0;
	gl_FragColor = c;
}

}
```







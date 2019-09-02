cc.Class({
    extends: cc.Component,

    properties: {
        material: cc.Material,
    },

    onLoad() {
        this.gl = cc.renderer.device._gl;

        this.yTex = this.gl.createTexture();
        this.uTex = this.gl.createTexture();
        this.vTex = this.gl.createTexture();

        this.sprite = this.node.addComponent(cc.Sprite);
        this.spriteFrame = new cc.SpriteFrame();
        this.texture = new cc.RenderTexture();
        this.sprite.spriteFrame = this.spriteFrame;
        this.texture.initWithSize(
            this.node.width,
            this.node.height,
            cc.game["_renderContext"]["STENCIL_INDEX8"]
        );
        this.spriteFrame.setTexture(this.texture);
        this.sprite.setMaterial(0, this.material);
    },

    start() {
        this.player = new JSMpeg.Player("ws://10.10.10.32:8001", {});
        this.player.video.onDecodeCallback = evt => this._onPictureDecoded(evt);
        
    },

    _onPictureDecoded(evt) {
        this.renderWidth = evt.destination.width;
        this.renderHeight = evt.destination.height;
        this.par = evt.instance.heapU8;
        
        if (this.par) {
            var ptrY = this.player.video.functions._mpeg1_decoder_get_y_ptr(
                this.player.video.decoder
            );
            var ptrCr = this.player.video.functions._mpeg1_decoder_get_cr_ptr(
                this.player.video.decoder
            );
            var ptrCb = this.player.video.functions._mpeg1_decoder_get_cb_ptr(
                this.player.video.decoder
            );
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

            this.setGLTexture(1, this.yTex, this.renderWidth, this.renderHeight, this.yData);
            this.setGLTexture(2, this.uTex, this.renderWidth/2, this.renderHeight/2,this.uData);
            this.setGLTexture(3, this.vTex, this.renderWidth/2, this.renderHeight/2,this.vData);
        }
    },

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


});

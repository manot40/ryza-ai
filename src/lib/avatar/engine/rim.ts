import { RIM_VS, RIM_FS } from './shader';
import type { SpineHost, SpineShader, SceneConfigLight } from './types';

export class RimPass {
  private _fbo: WebGLFramebuffer | null = null;
  private _fboTex: WebGLTexture | null = null;
  private _fboW = 0;
  private _fboH = 0;
  private _rimShader: SpineShader | null = null;
  private _quadBuf: WebGLBuffer | null = null;

  destroy(gl: WebGLRenderingContext | null): void {
    if (gl) {
      if (this._fbo) gl.deleteFramebuffer(this._fbo);
      if (this._fboTex) gl.deleteTexture(this._fboTex);
      if (this._quadBuf) gl.deleteBuffer(this._quadBuf);
    }
    this._fbo = null;
    this._fboTex = null;
    this._fboW = 0;
    this._fboH = 0;
    this._rimShader = null;
    this._quadBuf = null;
  }

  ensureFbo(host: SpineHost): boolean {
    const gl = host.gl;
    if (!gl) return false;
    const w = host.canvas.width;
    const h = host.canvas.height;
    if (this._fbo && this._fboW === w && this._fboH === h) return true;

    if (this._fbo) {
      gl.deleteFramebuffer(this._fbo);
      gl.deleteTexture(this._fboTex);
      this._fbo = null;
      this._fboTex = null;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (!ok) {
      if (fbo) gl.deleteFramebuffer(fbo);
      if (tex) gl.deleteTexture(tex);
      return false;
    }

    this._fbo = fbo;
    this._fboTex = tex;
    this._fboW = w;
    this._fboH = h;

    if (!this._rimShader) {
      const spineObj = (
        window as unknown as { spine?: { Shader: new (ctx: unknown, vs: string, fs: string) => SpineShader } }
      ).spine;
      if (!spineObj?.Shader) return false;
      try {
        this._rimShader = new spineObj.Shader(host.ctx, RIM_VS, RIM_FS);
      } catch {
        return false;
      }
    }

    if (!this._quadBuf) {
      this._quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
    }
    return true;
  }

  get fbo(): WebGLFramebuffer | null {
    return this._fbo;
  }

  get fboWidth(): number {
    return this._fboW;
  }

  get fboHeight(): number {
    return this._fboH;
  }

  blit(host: SpineHost, light: SceneConfigLight | null | undefined): void {
    const gl = host.gl;
    const sh = this._rimShader;
    const prog = sh?.getProgram();
    if (!prog || !this._fboTex || !sh) return;

    const n = Number(light?.color) >>> 0;
    const cr = ((n >>> 16) & 255) / 255;
    const cg = ((n >>> 8) & 255) / 255;
    const cb = (n & 255) / 255;

    let deg = Number(light?.direction);
    if (Number.isNaN(deg)) deg = 220;
    const rad = (deg * Math.PI) / 180;

    let glow = Number(light?.rimGlowWidth);
    if (!(glow > 0)) glow = 12;
    let power = Number(light?.rimGlowPower);
    if (!(power > 0)) power = 2.4;
    let opac = Number(light?.rimOpacity);
    if (!(opac >= 0)) opac = 0.7;
    if (light?.rimEnabled === false) opac = 0;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    sh.bind();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._fboTex);
    sh.setUniformi('u_texture', 0);
    sh.setUniform2f('u_texel', 1 / this._fboW, 1 / this._fboH);
    sh.setUniform2f('u_light', Math.cos(rad) * glow, Math.sin(rad) * glow);
    sh.setUniform3f('u_rimColor', cr, cg, cb);
    sh.setUniformf('u_rimOpacity', opac);
    sh.setUniformf('u_glowPower', power);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._quadBuf);
    const locP = gl.getAttribLocation(prog, 'a_pos');
    const locU = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(locU);
    gl.vertexAttribPointer(locU, 2, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(locP);
    gl.disableVertexAttribArray(locU);
    sh.unbind();
  }
}

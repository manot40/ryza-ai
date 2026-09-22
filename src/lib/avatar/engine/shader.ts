export const RIM_VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const RIM_FS = `
#ifdef GL_ES
precision mediump float;
#endif
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texel;
uniform vec2 u_light;
uniform vec3 u_rimColor;
uniform float u_rimOpacity;
uniform float u_glowPower;
void main() {
  vec4 c = texture2D(u_texture, v_uv);
  if (c.a < 0.02) { gl_FragColor = vec4(0.0); return; }
  float acc = 0.0;
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    float a2 = texture2D(u_texture, v_uv + u_light * t * u_texel).a;
    acc += (1.0 - a2) * pow(1.0 - t, u_glowPower);
  }
  acc /= 6.0;
  gl_FragColor = vec4(u_rimColor * acc * u_rimOpacity, acc * u_rimOpacity);
}
`;

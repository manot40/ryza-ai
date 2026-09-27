in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform vec2 uLight;
uniform vec3 uRimColor;
uniform float uRimOpacity;
uniform float uGlowPower;

void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a < 0.02) {
    finalColor = vec4(0.0);
    return;
  }
  float acc = 0.0;
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    float a2 = texture(uTexture, vTextureCoord + uLight * t * uTexel).a;
    acc += (1.0 - a2) * pow(1.0 - t, uGlowPower);
  }
  acc /= 6.0;
  finalColor = vec4(uRimColor * acc * uRimOpacity, acc * uRimOpacity);
}

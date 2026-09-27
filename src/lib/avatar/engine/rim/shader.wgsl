struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct RimUniforms {
  uTexel: vec2<f32>,
  uLight: vec2<f32>,
  uRimColor: vec3<f32>,
  uRimOpacity: f32,
  uGlowPower: f32,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;

@group(1) @binding(0) var<uniform> rimUniforms: RimUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4<f32>(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(
  @location(0) aPosition: vec2<f32>,
) -> VSOutput {
  return VSOutput(
    filterVertexPosition(aPosition),
    filterTextureCoord(aPosition)
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
) -> @location(0) vec4<f32> {
  var c: vec4<f32> = textureSampleLevel(uTexture, uSampler, uv, 0.0);
  if (c.a < 0.02) {
    return vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  var acc: f32 = 0.0;
  for (var i: i32 = 1; i <= 6; i = i + 1) {
    var t: f32 = f32(i) / 6.0;
    var a2: f32 = textureSampleLevel(uTexture, uSampler, uv + rimUniforms.uLight * t * rimUniforms.uTexel, 0.0).a;
    acc = acc + (1.0 - a2) * pow(1.0 - t, rimUniforms.uGlowPower);
  }
  acc = acc / 6.0;
  var alpha: f32 = acc * rimUniforms.uRimOpacity;
  return vec4<f32>(rimUniforms.uRimColor * alpha, alpha);
}

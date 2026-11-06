/* Ported from seti-agente-comercial (red-hologram/shaders.ts), recoloured from SETI red to Signal blue. */
import * as THREE from "three";

/**
 * Exact materials from `red-hologram-avatar.html`, with wind/floaters/lift removed.
 * Soft red aura plane keeps the original bloom fill (no dark bg plate).
 */

export const FACE_MASK_GLSL = /* glsl */ `
  float faceMask(vec3 p){
    return smoothstep(.05,.3,p.z)*smoothstep(-.16,.04,p.y)*(1.-smoothstep(.56,.76,p.y))*(1.-smoothstep(.2,.36,abs(p.x)));
  }
`;

/** Soft red aura only — same glow term as the HTML bg, without the dark base plate. */
export const AURA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=vec4(position.xy,0.999,1.);
  }
`;

export const AURA_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uAspect;
  void main(){
    vec2 p=vUv-vec2(.5,.56);
    p.x*=uAspect;
    float g=exp(-dot(p,p)*5.5);
    // Embedded over the live webcam / UI (unlike the standalone HTML's own full-page
    // background), so this is just the soft red glow — no opaque background plate —
    // fading to fully transparent away from the head.
    // Same glow strength as the HTML (.55), over transparent instead of its dark plate.
    gl_FragColor=vec4(vec3(.04,.12,.4)*.55, g);
  }
`;

/**
 * Face rig for the packed mesh (no morph targets): the jaw / lower lip drop and
 * the upper lip lifts with uMouth. Shared by the skin and the splats so both move
 * together. Lip line measured on the model at y≈0.025, |x|<0.11.
 */
export const RIG_GLSL = /* glsl */ `
  uniform float uMouth;
  vec3 rig(vec3 p){
    float front=smoothstep(.18,.34,p.z);
    float wide=1.-smoothstep(.12,.24,abs(p.x));
    float below=smoothstep(.032,.018,p.y)*smoothstep(-.3,-.12,p.y);
    float above=smoothstep(.018,.032,p.y)*(1.-smoothstep(.06,.1,p.y))*(1.-smoothstep(.06,.12,abs(p.x)));
    p.y+=uMouth*(-.034*below*wide*front+.006*above*front);
    p.z-=uMouth*.008*below*wide*front;
    return p;
  }
`;

export const SKIN_VERTEX = /* glsl */ `
  ${RIG_GLSL}
  attribute vec3 col;attribute float curv;
  varying vec3 vCol;varying float vCurv;varying vec3 vN;varying vec3 vV;varying vec3 vP;
  void main(){vCol=col;vCurv=curv;vP=position;
    vec4 mv=modelViewMatrix*vec4(rig(position),1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);
    gl_Position=projectionMatrix*mv;}
`;

export const SKIN_FRAGMENT = /* glsl */ `
  ${FACE_MASK_GLSL}
  uniform float uTime;uniform vec3 uColor;uniform float uOpacity;uniform float uBlink,uMouth;
  varying vec3 vCol;varying float vCurv;varying vec3 vN;varying vec3 vV;varying vec3 vP;
  void main(){
    vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
    vec3 L=normalize(vec3(.25,.45,.85));
    float diff=clamp(dot(n,L),0.,1.);
    float fill=clamp(dot(n,normalize(vec3(-.6,.1,.5))),0.,1.)*.25;
    float ndv=clamp(dot(n,vV),0.,1.);
    float fres=pow(1.-ndv,2.6);
    float spec=pow(clamp(dot(n,normalize(L+vV)),0.,1.),70.);
    float lum=dot(vCol,vec3(.3,.59,.11));
    float cav=clamp(vCurv,0.,1.),ridge=clamp(-vCurv,0.,1.);
    float fm=faceMask(vP);
    float albedo=mix(.06,1.,pow(smoothstep(.06,.75,lum),1.3));
    float lips=smoothstep(.05,.14,vCol.r-vCol.g)*fm;
    vec3 c=uColor*(.03+.97*pow(diff+fill,1.5))*albedo;
    c*=1.-.8*cav;
    c+=uColor*ridge*.18*diff;
    c+=vec3(.6,.78,1.)*lips*.12*diff;
    c+=vec3(.82,.9,1.)*spec*(.25+.6*smoothstep(.5,.8,lum))*fm;
    c+=uColor*fres*.3*(1.-fm*.5);
    // Eyelids: a lid sweeps down over each eye opening (eyes measured at
    // x=±0.19, y=0.43), with a dark lash line on its edge.
    {
      vec2 ec=vec2(sign(vP.x)*.19,.43);
      vec2 e=(vP.xy-ec)/vec2(.105,.05);
      float inEye=(1.-smoothstep(.85,1.,length(e)))*smoothstep(.3,.38,vP.z)*step(.001,uBlink);
      float edge=1.-2.*uBlink;
      float lid=inEye*smoothstep(edge-.12,edge+.02,e.y);
      float lash=inEye*(1.-smoothstep(0.,.12,abs(e.y-edge)));
      vec3 lidC=uColor*(.03+.97*pow(diff+fill,1.5))*.72;
      c=mix(c,lidC,lid);
      c*=1.-.75*lash;
    }
    // Mouth: dark gap between the lips while speaking.
    float gap=uMouth*(1.-smoothstep(0.,.008+uMouth*.012,abs(vP.y-.025)))*(1.-smoothstep(.08,.12,abs(vP.x)))*smoothstep(.3,.4,vP.z);
    c*=1.-.9*gap;
    float sl=.9+.1*sin(vP.y*900.+uTime*3.);
    float band=exp(-pow((vP.y-(fract(uTime*.1)*2.6-1.3))*6.,2.));
    c=c*sl+uColor*band*.18;
    c*=.53*smoothstep(.0,.6,fm);
    c*=uOpacity;
    gl_FragColor=vec4(c,1.);
  }
`;

/** Original splat shader, including the wind (floaters, shimmer, bottom dissolve). */
export const HOLO_VERTEX = /* glsl */ `
  ${FACE_MASK_GLSL}
  ${RIG_GLSL}
  attribute float lum;attribute float rnd;
  attribute vec3 aStart;attribute vec3 aLogo;attribute vec3 aExit;attribute float aDelay;attribute float aWhirl;
  uniform float uTime,uSize,uPR,uFocus,uDisperse,uAssemble,uLogo,uGather;
  varying float vB;varying float vBlur;varying float vHot;varying vec2 vAxis;varying float vSq;varying vec3 vTint;varying float vEl;varying float vFm;varying float vFl;
  void main(){
    vec3 p=rig(position)+normal*.006;
    float fmk=faceMask(position);vFm=fmk;
    // CTA disperse only (no idle wind / floaters / bottom dissolve).
    float d=clamp(uDisperse,0.,1.);
    // Wind corridors: on boot splats stream in from side corridors along curved
    // (quadratic bezier) paths, staggered by distance; on disperse they blow out
    // along other corridors, and on reform they fly back the same way.
    vec3 rest=p;
    float ta=clamp((uAssemble-aDelay*.45)/.55,0.,1.);
    float ea=1.-pow(1.-ta,3.);
    vec3 dIn=rest-aStart;
    vec3 perpIn=normalize(vec3(-dIn.y,dIn.x,0.)+vec3(1e-5));
    vec3 midIn=mix(aStart,rest,.5)+perpIn*aWhirl*length(dIn)*.28;
    vec3 pin=mix(mix(aStart,midIn,ea),mix(midIn,rest,ea),ea);
    float td=clamp((d-aDelay*.3)/.7,0.,1.);
    float ed=td*td*(3.-2.*td);
    vec3 dOut=aExit-rest;
    vec3 perpOut=normalize(vec3(-dOut.y,dOut.x,0.)+vec3(1e-5));
    vec3 midOut=mix(rest,aExit,.5)+perpOut*aWhirl*length(dOut)*.18;
    vec3 pout=mix(mix(rest,midOut,ed),mix(midOut,aExit,ed),ed);
    p=pin+(pout-rest);
    float inFlight=1.-ea;
    // Gusty wind while flying in or out: splats jump and flutter.
    float gust=inFlight+ed*(1.-ed)*4.;
    p+=vec3(sin(uTime*3.1+rnd*40.),cos(uTime*2.6+rnd*57.),sin(uTime*1.9+rnd*23.)*.5)*.07*gust*(.4+fract(rnd*9.1));
    // SETI isologo ("Descubrir más"): after disperse, every splat locks onto the
    // disc / ring / wordmark targets (no thinning — text must stay readable).
    float tl=clamp((uLogo-aDelay*.28)/.72,0.,1.);
    float eL=tl*tl*(3.-2.*tl);
    // Opening (same as the seti-experto-digital LogoIntro): the isologo gathers
    // from scattered points. uGather stays at 1 outside the opening.
    float gi=1.-pow(1.-clamp(uGather*1.25-rnd*.25,0.,1.),3.);
    vec3 sd=normalize(vec3(fract(rnd*91.7),fract(rnd*37.3),fract(rnd*61.1))-.5+vec3(1e-4))*(1.2+fract(rnd*23.9)*2.);
    vec3 logoP=aLogo+sd*(1.-gi);
    // Gentle shimmer while the logo holds.
    logoP+=.006*vec3(sin(uTime*3.+rnd*40.),cos(uTime*2.6+rnd*31.),0.)*gi;
    p=mix(p,logoP,eL);
    float ringMember=1.;
    // Wind (from the HTML): a few loose floaters hovering off the surface,
    // a tiny living shimmer, and splats near the bottom lifting off and fading.
    // All of it eases out while the avatar disperses.
    float calm=(1.-d)*(1.-eL);
    float fl=step(.975,fract(rnd*13.1))*calm;
    p+=normal*fl*(.02+fract(rnd*5.3)*.09);vFl=fl;
    p+=normal*sin(uTime*1.7+rnd*60.)*.0025*calm;
    float bottom=smoothstep(-.55,-1.0,position.y);
    float life=fract(uTime*.08+rnd*7.);
    float lift=bottom*step(.72,rnd)*life*calm;
    p.y+=lift*.35;p.x+=lift*(rnd-.5)*.12;p+=normal*lift*.08;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    vec3 n=normalize(normalMatrix*normal);vec3 v=normalize(-mv.xyz);
    float ndv=clamp(dot(n,v),0.,1.);
    float diff=clamp(dot(n,normalize(vec3(.2,.5,.85))),0.,1.);
    float fres=pow(1.-ndv,2.5);
    float detail=mix(.4,1.05,smoothstep(.05,.55,lum));
    float band=exp(-pow((position.y-(fract(uTime*.1)*2.6-1.3))*6.,2.));
    float tw=.7+.3*sin(uTime*(1.2+rnd*2.5)+rnd*40.);
    vB=((.08+1.1*pow(diff,1.4))*detail + fres*.9 + band*.6)*tw*(1.-lift)*1.45;
    vHot=step(.985,rnd);
    // Dispersed particles should recede into the wind, not form a bright
    // second silhouette. Hot pixels are also disabled as the avatar breaks up.
    vB+=vHot*.9*tw*(1.-d);
    vB*=mix(.85,1.,smoothstep(-.9,-.15,position.y));
    // Only ~18% of splats stay visible as "streamers" along the wind corridors;
    // the rest materialise as they arrive (and vanish first on disperse), so
    // 100k+ splats read as wind streams instead of a uniform haze.
    float streamer=step(.65,fract(rnd*17.3));
    float visIn=mix(smoothstep(.35,.9,ea),1.,streamer);
    float visOut=mix(1.-smoothstep(0.,.3,ed),1.-smoothstep(.55,1.,ed),streamer);
    vB*=visIn*mix(visOut,1.,eL)*mix(1.,ringMember,eL)*mix(1.,.8,inFlight*streamer);
    // Flat, bright isologo — drop face lighting so the mark reads cleanly.
    vB=mix(vB,(.95+.35*vHot)*tw,eL*.92);
    vB*=mix(1.,.25+.75*gi,eL);
    float depth=-mv.z;
    vBlur=clamp((abs(depth-uFocus)-.15)*.9,0.,1.);
    vec2 sn=n.xy;float sl=length(sn);
    vAxis=sl>1e-4?sn/sl:vec2(1.,0.);
    float ra=rnd*43.7;vec2 rv=vec2(cos(ra),sin(ra));vAxis=normalize(mix(rv,vAxis,smoothstep(.2,.7,sl)));
    vEl=1.+fract(rnd*3.7)*1.3;
    vSq=clamp(ndv,.22,1.);
    vTint=mix(vec3(.12,.36,1.),vec3(.32,.58,1.),fract(rnd*7.31));
    vTint=mix(vTint,vec3(.7,.86,1.),vHot*.6*(1.-d));
    vTint=mix(vTint,vec3(.03,.12,.55),d*.7*(1.-eL));
    // Slightly warmer / brighter red while the logo is formed.
    vTint=mix(vTint,vec3(.36,.62,1.),eL*.55);
    float size=(4.6+rnd*5.5)*mix(1.,.8,fmk)*(1.+fl*1.5)*(1.+vBlur*.6)*(1.-lift*.4)*mix(1.,.75,streamer*max(inFlight,ed));
    // Keep logo splats denser so disc + SETI letters stay solid.
    size*=mix(1.,.72,d)*mix(1.,.95,eL);
    gl_PointSize=uSize*uPR*size*(3.9/max(depth,.2));
    gl_Position=projectionMatrix*mv;
  }
`;

export const HOLO_FRAGMENT = /* glsl */ `
  varying float vB;varying float vBlur;varying float vHot;varying vec2 vAxis;varying float vSq;varying vec3 vTint;varying float vEl;varying float vFm;varying float vFl;
  void main(){
    vec2 p=(gl_PointCoord-.5)*2.;p.y=-p.y;
    float a=dot(p,vAxis)/(vSq*1.),b=dot(p,vec2(-vAxis.y,vAxis.x));
    b*=vEl;float d2=a*a+b*b;
    if(d2>1.)discard;
    float g=exp(-d2*4.5);
    float alpha=g*mix(.36,.18,vBlur)*mix(1.,.55,vFl)*mix(1.,.8,vFm);
    gl_FragColor=vec4(vTint*vB*alpha,1.);
  }
`;

// Same red as red-hologram-avatar.html. That demo used three r128 (no color
// management), so #ff2433 went to the shader as raw 0-1 values. Three 0.186
// converts hex to linear, which darkens and over-saturates the skin — store the
// raw values instead so the face matches the HTML.
export const RED_HOLO_COLOR = new THREE.Color().setRGB(
  0x2f / 255,
  0x6b / 255,
  1,
  THREE.LinearSRGBColorSpace,
);

export function createAuraMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uAspect: { value: 1 } },
    vertexShader: AURA_VERTEX,
    fragmentShader: AURA_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
}

export function createSkinMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: RED_HOLO_COLOR.clone() },
      uOpacity: { value: 1 },
      uBlink: { value: 0 },
      uMouth: { value: 0 },
    },
    vertexShader: SKIN_VERTEX,
    fragmentShader: SKIN_FRAGMENT,
    side: THREE.DoubleSide,
    // The aura plane is transparent (it composites over the page), and three
    // always draws opaque objects before transparent ones regardless of
    // renderOrder — so the aura (depthTest off) was painted over the face and
    // hid the skin. Putting the skin in the transparent list lets renderOrder
    // apply: aura (-1) -> skin (0) -> splats (1). It still writes depth and
    // outputs alpha 1, so it renders fully opaque.
    transparent: true,
    depthWrite: true,
  });
}

export function createHoloSplatMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: RED_HOLO_COLOR.clone() },
      uSize: { value: 1 },
      uPR: { value: pixelRatio },
      uFocus: { value: 3.3 },
      uDisperse: { value: 0 },
      uAssemble: { value: 1 },
      uLogo: { value: 0 },
      uGather: { value: 1 },
      uMouth: { value: 0 },
    },
    vertexShader: HOLO_VERTEX,
    fragmentShader: HOLO_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/**
 * Final pass: turn the rendered hologram into a transparent layer.
 * Alpha comes from the light itself, so dark areas (the old background, the
 * black gaps between splats) become see-through and the glow composites over
 * the page like light. The canvas is premultiplied, and rgb <= alpha holds.
 */
export const LIGHT_TO_ALPHA_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      float a=clamp(max(c.r,max(c.g,c.b))*1.1,0.,1.);
      gl_FragColor=vec4(min(c,vec3(a)),a);
    }`,
};

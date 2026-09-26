// Um three de mentira para o teste. O jsdom não tem WebGL: o WebGLRenderer de
// verdade lança ao criar o contexto, e o jogo nem monta. Este dublê é o
// `tests/setup/threeStub.js` do RoqueOS (o que o teste das Damas e o do
// tabuleiro 3D usavam lá, até 25/09/2026), recortado ao que o
// `src/tabuleiro3d.js` toca: cena, câmera, luzes com sombra, grupo, malha, as
// geometrias de torno, caixa, extrusão, anel, disco e plano, os materiais, a
// textura de canvas e o raycaster.
//
// Três coisas a mais que lá, para o teste ver pelo lado de fora o que antes só
// dava para ver abrindo o componente:
// - o renderer guarda as opções com que nasceu, o pixel ratio, se ligou a
//   sombra, quantos quadros desenhou, a última cena e se foi descartado, e se
//   pendura no canvas que recebeu. É assim que o teste confere que o modo leve
//   do host chega no código de GPU, que desmontar solta o contexto e que casa
//   está destacada no tabuleiro;
// - geometria, material e textura descartados ficam marcados, e toda
//   instância fica na lista `criados`, para o teste medir vazamento;
// - o raycaster acerta a casa que o teste mandar em `Raycaster.mira`
//   (`[linha, coluna]`; null é tocar fora do tabuleiro, como era sempre lá).
//   Sem isso o toque no tabuleiro, que é o único jeito de jogar, ficava sem
//   teste.
// Uso: vi.mock('three', async () => (await import('./threeStub.js')).criarThreeFalso())
export function criarThreeFalso() {
  const criados = []
  const anotar = (o) => {
    criados.push(o)
    return o
  }

  class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    set(x, y, z) {
      this.x = x
      this.y = y
      this.z = z
      return this
    }
    setScalar(s) {
      return this.set(s, s, s)
    }
    copy(v) {
      return this.set(v.x, v.y, v.z)
    }
    clone() {
      return new Vec3(this.x, this.y, this.z)
    }
  }
  class Vec2 {
    constructor(x = 0, y = 0) {
      this.x = x
      this.y = y
    }
    set(x, y) {
      this.x = x
      this.y = y
      return this
    }
  }
  class Color {
    constructor(hex = 0xffffff) {
      this.hex = hex
    }
    set(hex) {
      this.hex = hex
      return this
    }
  }
  class Object3D {
    constructor() {
      this.children = []
      this.position = new Vec3()
      this.scale = new Vec3(1, 1, 1)
      this.rotation = new Vec3()
      this.visible = true
      this.userData = {}
    }
    add(...filhos) {
      this.children.push(...filhos)
    }
    remove(x) {
      this.children = this.children.filter((c) => c !== x)
    }
  }
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super()
      this.geometry = geometry
      this.material = material
    }
  }
  class Geometry {
    constructor(...args) {
      this.args = args
      this.descartado = false
      anotar(this)
    }
    rotateX() {
      return this
    }
    translate() {
      return this
    }
    dispose() {
      this.descartado = true
    }
  }
  class Material {
    constructor(opcoes = {}) {
      Object.assign(this, opcoes)
      this.opacity = opcoes.opacity ?? 1
      this.color = new Color(opcoes.color)
      this.descartado = false
      anotar(this)
    }
    clone() {
      return new this.constructor({ ...this, color: this.color.hex })
    }
    dispose() {
      this.descartado = true
    }
  }
  class Shape {
    moveTo() {
      return this
    }
    lineTo() {
      return this
    }
    bezierCurveTo() {
      return this
    }
    closePath() {
      return this
    }
  }
  class Camera extends Object3D {
    constructor(fov, aspect) {
      super()
      this.fov = fov
      this.aspect = aspect
    }
    updateProjectionMatrix() {}
    lookAt() {}
  }
  class DirectionalLight extends Object3D {
    constructor() {
      super()
      this.castShadow = false
      this.shadow = {
        mapSize: new Vec2(),
        camera: { left: 0, right: 0, top: 0, bottom: 0, far: 0 },
        bias: 0,
      }
    }
  }
  class CanvasTexture {
    constructor(imagem) {
      this.image = imagem
      this.colorSpace = ''
      this.anisotropy = 1
      this.descartado = false
      anotar(this)
    }
    dispose() {
      this.descartado = true
    }
  }
  class Raycaster {
    setFromCamera() {}
    // O tabuleiro acha a casa pelo ponto em que o raio bate na laje:
    // x = coluna - 3,5 e z = linha - 3,5, no centro da casa.
    intersectObject() {
      if (!Raycaster.mira) return []
      const [linha, coluna] = Raycaster.mira
      return [{ point: { x: coluna - 3.5, y: 0.3, z: linha - 3.5 }, distance: 1 }]
    }
  }
  Raycaster.mira = null
  class WebGLRenderer {
    constructor(opcoes = {}) {
      this.opcoes = opcoes
      this.pixelRatio = 1
      this.tamanho = null
      this.quadros = 0
      this.descartado = false
      this.shadowMap = { enabled: false, type: 0 }
      this.domElement = opcoes.canvas ?? document.createElement('canvas')
      this.domElement.__renderizador = this
    }
    setPixelRatio(r) {
      this.pixelRatio = r
    }
    setSize(w, h) {
      this.tamanho = [w, h]
    }
    render(cena) {
      this.quadros++
      this.cena = cena
    }
    dispose() {
      this.descartado = true
    }
  }
  return {
    criados,
    Scene: Object3D,
    Group: Object3D,
    Mesh,
    Shape,
    Vector2: Vec2,
    Vector3: Vec3,
    LatheGeometry: class extends Geometry {},
    BoxGeometry: class extends Geometry {},
    ExtrudeGeometry: class extends Geometry {},
    TorusGeometry: class extends Geometry {},
    PlaneGeometry: class extends Geometry {},
    CircleGeometry: class extends Geometry {},
    RingGeometry: class extends Geometry {},
    MeshPhysicalMaterial: class extends Material {},
    MeshStandardMaterial: class extends Material {},
    MeshBasicMaterial: class extends Material {},
    ShadowMaterial: class extends Material {},
    HemisphereLight: class extends Object3D {},
    DirectionalLight,
    PerspectiveCamera: Camera,
    CanvasTexture,
    Raycaster,
    WebGLRenderer,
    PCFSoftShadowMap: 2,
    SRGBColorSpace: 'srgb',
  }
}


import { getWebGLContext } from './utils';
import { GLProgram } from './GLProgram';
import { VertexShader } from './effects/VertexShader';
import { SplatShader } from './effects/SplatShader';
import { ClearShader } from './effects/ClearShader';
import { DisplayShader } from './effects/DisplayShader';
//import  {AdvectionShader} from './effects/AdvectionShader';
import { AdvectionManualFilteringShader } from './effects/AdvectionManualFilteringShader';
import { DivergenceShader } from './effects/DivergenceShader';
import { CurlShader } from './effects/CurlShader';
import { VorticityShader } from './effects/VorticityShader';
import { PressureShader } from './effects/PressureShader';
import { GradientSubtractShader } from './effects/GradientSubtractShader';



let texId = 0;

let CONFIG = {
    TEXTURE_DOWNSAMPLE: 1,
    DENSITY_DISSIPATION: 0.98,
    VELOCITY_DISSIPATION: 0.99,
    PRESSURE_DISSIPATION: 0.8,
    PRESSURE_ITERATIONS: 25,
    CURL: 30,
    SPLAT_RADIUS: 0.005
}
function pointerPrototype() {
    this.id = -1;
    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;
    this.down = false;
    this.moved = false;
    this.color = [30, 0, 300];
}
class MyGame {
    createDoubleFBO(internalFormat, format, type, param) {
        let fbo1 = this.createFBO(internalFormat, format, type, param);
        let fbo2 = this.createFBO(internalFormat, format, type, param);
        return {
            get read() {
                return fbo1;
            },
            get write() {
                return fbo2;
            },
            swap() {
                let temp = fbo1;
                fbo1 = fbo2;
                fbo2 = temp;
            }
        }
    }
    createFBO(internalFormat, format, type, param) {
        let { gl, textureWidth, textureHeight } = this;
        gl.activeTexture(gl.TEXTURE0 + texId);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, textureWidth, textureHeight, 0, format, type, null);

        let fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, textureWidth, textureHeight);
        gl.clear(gl.COLOR_BUFFER_BIT);
        let lastId = texId;
        texId = texId + 1;
        let rt = [texture, fbo, lastId]
        //console.log(rt);
        return rt;
    }
    initFramebuffers() {
        let { gl, ext } = this;
        this.textureWidth = gl.drawingBufferWidth >> CONFIG.TEXTURE_DOWNSAMPLE;
        this.textureHeight = gl.drawingBufferHeight >> CONFIG.TEXTURE_DOWNSAMPLE;
        //gl.viewport(0, 0, this.textureWidth, this.textureHeight);
        
        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA;
        const rg = ext.formatRG;
        const r = ext.formatR;
        this.velocity = this.createDoubleFBO(rg.internalFormat, rg.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST);
        this.density = this.createDoubleFBO(rgba.internalFormat, rgba.format, texType, ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST);

        this.divergence = this.createFBO(r.internalFormat, r.format, texType, gl.NEAREST);
        this.curl = this.createFBO(r.internalFormat, r.format, texType, gl.NEAREST);
        this.pressure = this.createDoubleFBO(r.internalFormat, r.format, texType, gl.NEAREST);

    }

    makePrograms() {
        //console.log(this.ext);
        let { gl, ext } = this;
        this.clearProgram = new GLProgram(gl, VertexShader, ClearShader);
        this.displayProgram = new GLProgram(gl, VertexShader, DisplayShader);
        this.splatProgram = new GLProgram(gl, VertexShader, SplatShader);
        //console.log('not ext.SupportLinearFiltering',!ext.SupportLinearFiltering);
        //this.advectionProgram = new GLProgram(gl,VertexShader, ext.SupportLinearFiltering ? 
        //    AdvectionShader : AdvectionManualFilteringShader);
        this.advectionProgram = new GLProgram(gl, VertexShader, AdvectionManualFilteringShader);
        this.divergenceProgram = new GLProgram(gl, VertexShader, DivergenceShader);
        this.curlProgram = new GLProgram(gl, VertexShader, CurlShader);
        this.vorticityProgram = new GLProgram(gl, VertexShader, VorticityShader);
        this.pressureProgram = new GLProgram(gl, VertexShader, PressureShader);
        this.gradienSubtractProgram = new GLProgram(gl, VertexShader, GradientSubtractShader);

    }
    constructor() {
        let canvas = document.getElementById('canvas');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        this.canvas = canvas;
        let { gl, ext } = getWebGLContext(canvas);
        this.gl = gl;
        this.ext = ext;
        this.pointer = new pointerPrototype();

        this.initFramebuffers();
        this.makePrograms();
        this.blit = (() => {
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);

            return (destination) => {
                gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
                gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
            }
        })();

    }
    bindEvents() {
        let { canvas, pointer } = this;
        let self = this;
        canvas.addEventListener('mousemove', (e) => {
            pointer.moved = pointer.down;
            pointer.dx = (e.offsetX - pointer.x) * 10.0;
            pointer.dy = (e.offsetY - pointer.y) * 10.0;
            pointer.x = e.offsetX;
            pointer.y = e.offsetY;
        });


        canvas.addEventListener('mousedown', () => {
            pointer.down = true;
            pointer.color = [Math.random() + 0.2, Math.random() + 0.2, Math.random() + 0.2];
        });


        window.addEventListener('mouseup', () => {
            pointer.down = false;
        });
       
        window.onresize = () => {
            self.resizeCanvas().bind(self);
        }

    }

    run() {

        this.lastTime = Date.now();
        this.bindEvents();
        this.multipleSplats(parseInt(Math.random() * 2) + 4);
        this.update();
    }
    update() {
        let { gl, textureWidth, textureHeight, pointer, velocity, density, pressure, divergence, curl } = this;
        let { advectionProgram, curlProgram, vorticityProgram, divergenceProgram,
            clearProgram, pressureProgram, gradienSubtractProgram, displayProgram } = this;
       
        const dt = Math.min((Date.now() - this.lastTime) / 1000, 0.016);
        this.lastTime = Date.now();
        gl.viewport(0, 0, textureWidth, textureHeight);
        advectionProgram.use();
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);//[texture, fbo, texId]
        gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read[2]);
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
        this.blit(velocity.write[1]);
        velocity.swap();

        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read[2]);
        gl.uniform1i(advectionProgram.uniforms.uSource, density.read[2]);
        gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
        this.blit(density.write[1]);
        density.swap();

        if (pointer.moved) {
            this.splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color);
            pointer.moved = false;

        }

        curlProgram.use();
        gl.uniform2f(curlProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read[2]);
        this.blit(curl[1]);//[texture, fbo, texId]

        vorticityProgram.use();
        gl.uniform2f(vorticityProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read[2]);
        gl.uniform1i(vorticityProgram.uniforms.uCurl, curl[2]);
        gl.uniform1f(vorticityProgram.uniforms.curl, CONFIG.CURL);
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
        this.blit(velocity.write[1]);
        velocity.swap();

        divergenceProgram.use();
        gl.uniform2f(divergenceProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read[2]);
        this.blit(divergence[1]);

        clearProgram.use();
        let pressureTexId = pressure.read[2];
        gl.activeTexture(gl.TEXTURE0 + pressureTexId);
        gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]);
        gl.uniform1i(clearProgram.uniforms.uTexture, pressureTexId);
        gl.uniform1f(clearProgram.uniforms.value, CONFIG.PRESSURE_DISSIPATION);
        this.blit(pressure.write[1]);
        pressure.swap();

        pressureProgram.use();
        gl.uniform2f(pressureProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence[2]);
        pressureTexId = pressure.read[2];
        gl.uniform1i(pressureProgram.uniforms.uPressure, pressureTexId);
        gl.activeTexture(gl.TEXTURE0 + pressureTexId);
        for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
            gl.bindTexture(gl.TEXTURE_2D, pressure.read[0]);
            this.blit(pressure.write[1]);
            pressure.swap();
        }

        gradienSubtractProgram.use();
        gl.uniform2f(gradienSubtractProgram.uniforms.texelSize, 1.0 / textureWidth, 1.0 / textureHeight);
        gl.uniform1i(gradienSubtractProgram.uniforms.uPressure, pressure.read[2]);
        gl.uniform1i(gradienSubtractProgram.uniforms.uVelocity, velocity.read[2]);
        this.blit(velocity.write[1]);
        velocity.swap();

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        displayProgram.use();
        gl.uniform1i(displayProgram.uniforms.uTexture, density.read[2]);
        this.blit(null);
        let self = this;
        requestAnimationFrame(self.update.bind(self));

    }

    splat(x, y, dx, dy, color) {
        let { canvas, gl, velocity, density, splatProgram } = this;
        splatProgram.use();
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read[2]);
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x / canvas.width, 1.0 - y / canvas.height);
        gl.uniform3f(splatProgram.uniforms.color, dx, -dy, 1.0);
        gl.uniform1f(splatProgram.uniforms.radius, CONFIG.SPLAT_RADIUS);
        this.blit(velocity.write[1]);//[texture, fbo, texId]
        velocity.swap();

        gl.uniform1i(splatProgram.uniforms.uTarget, density.read[2]);
        gl.uniform3f(splatProgram.uniforms.color, color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
        this.blit(density.write[1]);
        density.swap();
    }

    multipleSplats(amount) {
        for (let i = 0; i < amount; i++) {
            const color = [Math.random() * 10, Math.random() * 10, Math.random() * 10];
            const x = canvas.width * Math.random();
            const y = canvas.height * Math.random();
            const dx = 1000 * (Math.random() - 0.5);
            const dy = 1000 * (Math.random() - 0.5);
            this.splat(x, y, dx, dy, color);
        }
    }
    resizeCanvas() {
        let { canvas } = this;
        if (canvas.width != canvas.clientWidth || canvas.height != canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            this.initFramebuffers();
        }
    }
};

export { MyGame };
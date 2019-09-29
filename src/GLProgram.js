
class GLProgram {
    constructor (gl,vertexSrc, fragmentSrc) {
        this.gl=gl;
        let vertexShader=this.compileShader(gl.VERTEX_SHADER, vertexSrc);
        let fragmentShader=this.compileShader(gl.FRAGMENT_SHADER,fragmentSrc);
        this.uniforms = {};
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw gl.getProgramInfoLog(this.program);
  
        const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniformName] = gl.getUniformLocation(this.program, uniformName);
        }
    }
  
    use() {
      this.gl.useProgram(this.program);
    }
    compileShader (type, source) {
        let gl=this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
      
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw gl.getShaderInfoLog(shader);
      
        return shader;
    }

  }
  export {GLProgram};
  
  
  
  
  
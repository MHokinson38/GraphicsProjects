/**
 * @file MP5.js - A simple WebGL rendering engine
 * @author Ian Rudnick <itr2@illinois.edu>
 * @brief Starter code for CS 418 MP5 at the University of Illinois at
 * Urbana-Champaign.
 * 
 * Updated Spring 2021 for WebGL 2.0/GLSL 3.00 ES.
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas to draw on */
var canvas;

/** @global The GLSL shader program */
var shaderProgram;

/** @global An object holding the geometry for your 3D model */
var sphere1;

/** @global The Model matrix */
var modelViewMatrix = glMatrix.mat4.create();
/** @global The Model matrix */
var viewMatrix = glMatrix.mat4.create();
/** @global The Projection matrix */
var projectionMatrix = glMatrix.mat4.create();
/** @global The Normal matrix */
var normalMatrix = glMatrix.mat3.create();

// Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [0.25, 0.75, 1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kDiffuse = [0.25, 0.75, 1.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [1.0, 1.0, 1.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 2;

/** @global Ambient light color */
const lAmbient = [0.4, 0.4, 0.4];
/** @global Diffuse light color */
const lDiffuse = [1.0, 1.0, 1.0];
/** @global Specular  light color */
const lSpecular = [1.0, 1.0, 1.0];

/** @global List of particles in container*/
var particles = [];
/** @global Previous time (for phys calculations) */
var previousTime = 0;
/** @global Keyboard input monitoring */
var keys = {};

//======= Particle constants =============
/** @global  Densitity of the particles for calculating mass */
const particleDensity = .5;
/** @global Bounding box limit (-bound, bound) in all dimensions*/
const chamberSize = 2.5;
/** @global Initial speed (m/s) */
const initSpeed = 3;
/** @global Range of radii to generate, [lower,upper] */
const radiusRange = [.1,.5];

const kDEBUG = true;

/**
 * Prints debug messages if debug switch is on 
 * @param {String} string Debug statement 
 */
 function debug(string) {
   console.log("In debug");
  if (kDEBUG) {
    console.log(string);
  }
}

/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Key handler for pressing down 
 * logs into global keys dict 
 * @param {*} event 
 */
 function keyDown(event) {
  // console.log("Key press ashhhhhh");
  // debug("Key Press: " + event.key);

  // keys[event.keyCode] = true;

  if (event.keyCode == 32) { // Space Bar 
    console.log("Hitting the space bar");
    addParticle();
  }
  if (event.keyCode == 8) { // Backspace 
    particles = [];
  }
}
/**
 * Key handler for release of key 
 * Logs into global keys dict
 * @param {*} event 
 */
function keyUp(event) {
  debug("Key Release: " + event.key);
  keys[event.keyCode] = false;
}

/**
 * Handle key presses and update speed/orientation appropriately 
 */
 function handleKeyPress() { 
  if (keys[32]) { // Space Bar 
    addParticle();
  }
  if (keys[8]) { // Backspace 
    particles.clear();
  }
 }
//-----------------------------------------------------------------------------
// Setup functions (run once when the webpage loads)
/**
 * Startup function called from the HTML code to start program.
 */
function startup() {
  // Set up the canvas with a WebGL context.
  canvas = document.getElementById("glCanvas");
  gl = createGLContext(canvas);

  // Compile and link a shader program.
  setupShaders();

  // Register Key Handlers 
  document.onkeydown = keyDown;
  document.onkeyup = keyUp;

  // Note to self: Make sure to render the balls in bounds pretty far away, 
  // essentially setting the points as anything close to the origin is too close 
  for(var i = 0; i < 1; ++i) {
    addParticle();
  }
  
  // Create the projection matrix with perspective projection.
  const near = 0.1;
  const far = 200.0;
  glMatrix.mat4.perspective(projectionMatrix, degToRad(45), 
                            gl.viewportWidth / gl.viewportHeight,
                            near, far);
    
  // Set the background color to black (you can change this if you like).    
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT); // Thanks campuswire 

  // Start animating.
  requestAnimationFrame(animate);
}

/**
 * Creates a particle with a random position in the simulation box. It will also 
 * generate a random color, radius, and mass (mass will be dependent on the radius of the sphere
 * so that collisions between particles, if implemented, look realistic)
 */
function addParticle() {
  // Generate position and random velocity, then normalize velocity to have speed of 3 m/s
  var xPos = 2 * chamberSize * Math.random() - chamberSize; // Center at -chamberSize, chamberSize
  var yPos = 2 * chamberSize * Math.random() - chamberSize;
  var zPos = 2 * chamberSize * Math.random() - chamberSize;

  var initVel = glMatrix.vec3.fromValues(Math.random(), Math.random(), Math.random());
  glMatrix.vec3.normalize(initVel, initVel);
  glMatrix.vec3.scale(initVel, initVel, initSpeed);

  // Generate random color 
  var colR = Math.random();
  var colG = Math.random();
  var colB = Math.random();

  // Generate the radius of the particle, at random within range
  var radius = radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0]);
  var mass = particleDensity * (4.0/3.0 * Math.PI * Math.pow(radius, 3));

  particles.push(new Particle(glMatrix.vec3.fromValues(xPos, yPos, zPos),
                              initVel,
                              glMatrix.vec3.fromValues(colR, colG, colB),
                              radius, 
                              mass
                              ));

  console.log(`Just rendered particle: ${particles.length}`);
  particles[particles.length - 1].consoleDisplay();
}


/**
 * Creates a WebGL 2.0 context.
 * @param {element} canvas The HTML5 canvas to attach the context to.
 * @return {Object} The WebGL 2.0 context.
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl2");
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}


/**
 * Loads a shader from the HTML document and compiles it.
 * @param {string} id ID string of the shader script to load.
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
    
  // Return null if we don't find an element with the specified id
  if (!shaderScript) {
    return null;
  }
    
  var shaderSource = shaderScript.text;
  
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
  
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader; 
}


/**
 * Sets up the vertex and fragment shaders.
 */
function setupShaders() {
  // Compile the shaders' source code.
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");
  
  // Link the shaders together into a program.
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  // If you have multiple different shader programs, you'll need to move this
  // function to draw() and call it whenever you want to switch programs
  gl.useProgram(shaderProgram);

  // Query the index of each attribute and uniform in the shader program.
  shaderProgram.locations = {};
  shaderProgram.locations.vertexPosition =
    gl.getAttribLocation(shaderProgram, "vertexPosition");
  shaderProgram.locations.vertexNormal =
    gl.getAttribLocation(shaderProgram, "vertexNormal");

  shaderProgram.locations.modelViewMatrix =
    gl.getUniformLocation(shaderProgram, "modelViewMatrix");
  shaderProgram.locations.projectionMatrix =
    gl.getUniformLocation(shaderProgram, "projectionMatrix");
  shaderProgram.locations.normalMatrix =
    gl.getUniformLocation(shaderProgram, "normalMatrix");

  shaderProgram.locations.kAmbient =
    gl.getUniformLocation(shaderProgram, "kAmbient");
  shaderProgram.locations.kDiffuse =
    gl.getUniformLocation(shaderProgram, "kDiffuse");
  shaderProgram.locations.kSpecular =
    gl.getUniformLocation(shaderProgram, "kSpecular");
  shaderProgram.locations.shininess =
    gl.getUniformLocation(shaderProgram, "shininess");
  
  shaderProgram.locations.lightPosition =
    gl.getUniformLocation(shaderProgram, "lightPosition");
  shaderProgram.locations.ambientLightColor =
    gl.getUniformLocation(shaderProgram, "ambientLightColor");
  shaderProgram.locations.diffuseLightColor =
  gl.getUniformLocation(shaderProgram, "diffuseLightColor");
  shaderProgram.locations.specularLightColor =
  gl.getUniformLocation(shaderProgram, "specularLightColor");
}

//-----------------------------------------------------------------------------
// Animation functions (run every frame)
/**
 * 
 * @param {number} currentTime 
 */
function deltaTime(currentTime) {
  var currentTSec = currentTime * .001; // ms -> s 
  var elapsedTime = currentTSec - previousTime;

  previousTime = currentTSec;
  
  return elapsedTime;
}

/**
 * Draws the current frame and then requests to draw the next frame.
 * @param {number} currentTime The elapsed time in milliseconds since the
 *    webpage loaded. 
 */
function animate(currentTime) {
  // handleKeyPress();

  // Add code here using currentTime if you want to add animations
  var deltaT = deltaTime(currentTime);

  // Set up the canvas for this frame
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  var viewMatrix = glMatrix.mat4.create();

  // Create a sphere mesh and set up WebGL buffers for it.
  // Generating a single buffer for all of our spheres, then we are going to have to modify the 
  // lookat to draw different spheres
  sphere1 = new Sphere(3);
  sphere1.setupBuffers(shaderProgram);
  sphere1.bindVAO();

  // Create the view matrix using lookat.
  const lookAtPt = glMatrix.vec3.fromValues(0.0, 0.0, 0.0);
  const eyePt = glMatrix.vec3.fromValues(0.0, 0.0, 10.0);
  const up = glMatrix.vec3.fromValues(0.0, 1.0, 0.0); 
  glMatrix.mat4.lookAt(viewMatrix, eyePt, lookAtPt, up);
  
  // Transform the light position to view coordinates
  var lightPosition = glMatrix.vec3.fromValues(5, 5, -15);
  glMatrix.vec3.transformMat4(lightPosition, lightPosition, viewMatrix);
  setLightUniforms(lAmbient, lDiffuse, lSpecular, lightPosition);

  particles.forEach(particle => {
      // Do the particle update 
      particle.update(deltaT * .5);

      var modelMatrix = glMatrix.mat4.create();      
      // Translate the model matrix to handle the position and size of the 
      // particle we are rendering
      glMatrix.mat4.translate(modelMatrix, modelMatrix, particle.position);
      glMatrix.mat4.scale(modelMatrix, modelMatrix, [particle.radius, particle.radius, particle.radius]); 
    
      // Concatenate the model and view matrices.
      // Remember matrix multiplication order is important.
      glMatrix.mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
    
      setMatrixUniforms();
    
      kAmbient = particle.color; 
      kDiffuse = particle.color;
      setMaterialUniforms(kAmbient, kDiffuse, kSpecular, shininess);
    
      // You can draw multiple spheres by changing the modelViewMatrix, calling
      // setMatrixUniforms() again, and calling gl.drawArrays() again for each
      // sphere. You can use the same sphere object and VAO for all of them,
      // since they have the same triangle mesh.
      gl.drawArrays(gl.TRIANGLES, 0, sphere1.numTriangles*3);
    });
    sphere1.unbindVAO();

  // Use this function as the callback to animate the next frame.
  requestAnimationFrame(animate);
}


/**
 * Sends the three matrix uniforms to the shader program.
 */
function setMatrixUniforms() {
  gl.uniformMatrix4fv(shaderProgram.locations.modelViewMatrix, false,
                      modelViewMatrix);
  gl.uniformMatrix4fv(shaderProgram.locations.projectionMatrix, false,
                      projectionMatrix);

  // We want to transform the normals by the inverse-transpose of the
  // Model/View matrix
  glMatrix.mat3.fromMat4(normalMatrix,modelViewMatrix);
  glMatrix.mat3.transpose(normalMatrix,normalMatrix);
  glMatrix.mat3.invert(normalMatrix,normalMatrix);

  gl.uniformMatrix3fv(shaderProgram.locations.normalMatrix, false,
                      normalMatrix);
}


/**
 * Sends material properties to the shader program.
 * @param {Float32Array} a Ambient material color.
 * @param {Float32Array} d Diffuse material color.
 * @param {Float32Array} s Specular material color.
 * @param {Float32} alpha shininess coefficient
 */
function setMaterialUniforms(a, d, s, alpha) {
  gl.uniform3fv(shaderProgram.locations.kAmbient, a);
  gl.uniform3fv(shaderProgram.locations.kDiffuse, d);
  gl.uniform3fv(shaderProgram.locations.kSpecular, s);
  gl.uniform1f(shaderProgram.locations.shininess, alpha);
}


/**
 * Sends light information to the shader program.
 * @param {Float32Array} a Ambient light color/intensity.
 * @param {Float32Array} d Diffuse light color/intensity.
 * @param {Float32Array} s Specular light color/intensity.
 * @param {Float32Array} loc The light position, in view coordinates.
 */
function setLightUniforms(a, d, s, loc) {
  gl.uniform3fv(shaderProgram.locations.ambientLightColor, a);
  gl.uniform3fv(shaderProgram.locations.diffuseLightColor, d);
  gl.uniform3fv(shaderProgram.locations.specularLightColor, s);
  gl.uniform3fv(shaderProgram.locations.lightPosition, loc);
}

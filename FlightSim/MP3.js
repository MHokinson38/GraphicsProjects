/**
 * @file MP2.js - A simple WebGL rendering engine
 * @author Ian Rudnick <itr2@illinois.edu>
 * @brief Starter code for CS 418 MP2 at the University of Illinois at
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

/** @global An object holding the geometry for your 3D terrain */
var myTerrain;

/** @global The Model matrix */
var modelViewMatrix = glMatrix.mat4.create();
/** @global The Projection matrix */
var projectionMatrix = glMatrix.mat4.create();
/** @global The Normal matrix */
var normalMatrix = glMatrix.mat3.create();

// Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [227/255, 191/255, 76/255];
/** @global Diffuse material color/intensity for Phong reflection */
var kDiffuse = [227/255, 191/255, 76/255];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [50/255, 50/255, 50/255];
/** @global Shininess exponent for Phong reflection */
var shininess = 2;

// Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0, 2, 2];
/** @global Ambient light color/intensity for Phong reflection */
var ambientLightColor = [0.1, 0.1, 0.1];
/** @global Diffuse light color/intensity for Phong reflection */
var diffuseLightColor = [1, 1, 1];
/** @global Specular light color/intensity for Phong reflection */
var specularLightColor = [1, 1, 1];

/** @global Edge color for black wireframe */
var kEdgeBlack = [0.0, 0.0, 0.0];
/** @global Edge color for white wireframe */
var kEdgeWhite = [0.7, 0.7, 0.7];

// Fog and background colors 
/** @global Background color (And fog color) */
const kBackgroundColor = glMatrix.vec4.fromValues(195.0/255.0, 195.0/255.0, 195.0/255.0, 1.0);
/** @global Const Float - Fog Density to be passes to fragment shader */
const kFogDensity = .075; 
/** @global Boolean - Toggle Fog */
var showFog = true;

// Flight sim values and constants 
/** @global Vec3 - Initial Position  */
const kInitPosition = glMatrix.vec3.fromValues(0.0,-6.0,5.0);
/** @global Vec3 - camPosition */
var camPosition = glMatrix.vec3.create();
/** @global Quaternion - Orientation of the camera (plane) */
var camOrientation = glMatrix.quat.create();
/** @global Vec3 - Direction of the Plane, will be normalized  */
var camDirection = glMatrix.vec3.create(); 
/** @global Vec3 - Inital direction of the camera  */
const kInitDirection = glMatrix.vec3.fromValues(0, 6.0, -3.0); // Initally moving along pos y 

/** @global Quaternion - Delta for camera orientation  */
var orientationDelta = glMatrix.quat.create(); 

/** @global Float - Euler Angle Delta: Step size for pitch and roll changes */
const kEulerStep = .2;

/** @global Const Float - Intial Cam (Plane) speed */
const kInitSpeed = .01;
/** @global Const Float - Step for increase/decrese speed */
const kCamSpeedStep = .001; 
/** @global Float - Speed of the camera */
var camSpeed = kInitSpeed; // Play around with this 

/** @global Dict - Keys which are currently pressed */
var keys = {};

/** @global Boolean - Debug Switch for print statements */
const kDEBUG = true;

/**
 * Prints debug messages if debug switch is on 
 * @param {String} string Debug statement 
 */
function debug(string) {
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


//-----------------------------------------------------------------------------
// Setup functions (run once)
/**
 * Startup function called from the HTML code to start program.
 */
function startup() {
  // Set up the canvas with a WebGL context.
  canvas = document.getElementById("glCanvas");
  gl = createGLContext(canvas);

  // Compile and link the shader program.
  setupShaders();

  // Let the Terrain object set up its own buffers.
  myTerrain = new Terrain(256, -20, 20, -20, 20);  
  myTerrain.setupBuffers(shaderProgram);
  
  // Register Key Handlers 
  document.onkeydown = keyDown;
  document.onkeyup = keyUp;

  // Set initial Plane values 
  resetPlane();

  // Set the background color to sky blue (you can change this if you like).
  gl.clearColor(kBackgroundColor[0], kBackgroundColor[1], kBackgroundColor[2], kBackgroundColor[3]);

  gl.enable(gl.DEPTH_TEST);
  requestAnimationFrame(animate);
}

//=======================
// Flight Sim Functions 
//=======================
/**
 * Key handler for pressing down 
 * logs into global keys dict 
 * @param {*} event 
 */
function keyDown(event) {
  debug("Key Press: " + event.key);

  // If 'Escape' is pressed, handle immediately (won't register holding Escape)
  if (event.key == "Escape") {
    resetPlane();
  }

  keys[event.key] = true;
}
/**
 * Key handler for release of key 
 * Logs into global keys dict
 * @param {*} event 
 */
function keyUp(event) {
  debug("Key Release: " + event.key);
  keys[event.key] = false;
}

/**
 * Handle key presses and update speed/orientation appropriately 
 */
function handleKeyPress() {
  // Use local euler angle changes 
  var eulerRotation = {'X': 0, 'Y': 0, 'Z': 0}; 

  if (keys['-']) {
    camSpeed -= kCamSpeedStep;
  }
  if (keys['=']) {
    camSpeed += kCamSpeedStep;
  }
  if (keys['ArrowRight']) { // Roll
    eulerRotation['Z'] -= 5*kEulerStep; // Roll CW 
  }
  if (keys['ArrowLeft']) {
    eulerRotation['Z'] += 5*kEulerStep; // Roll CCW 
  }
  if (keys['ArrowUp']) { // Pitch 
    eulerRotation['X'] += kEulerStep;
  }
  if (keys['ArrowDown']) {
    eulerRotation['X'] -= kEulerStep;
  }

  // Create delta quaternion
  glMatrix.quat.fromEuler(orientationDelta, eulerRotation['X'], eulerRotation['Y'], eulerRotation['Z']);
}

/**
 * Changes the orientation and position of the plane 
 */
function handlePlaneChanges() {
  // Orientation change 
  glMatrix.quat.multiply(camOrientation, camOrientation, orientationDelta); 

  // Find the current forward direction 
  glMatrix.vec3.transformQuat(camDirection, kInitDirection, camOrientation);
  glMatrix.vec3.normalize(camDirection, camDirection);
  let deltaPos = glMatrix.vec3.create(); glMatrix.vec3.scale(deltaPos, camDirection, camSpeed);

  glMatrix.vec3.add(camPosition, camPosition, deltaPos);
}

/**
 * Toggles the fog in rendering settings 
 */
function onFogToggle() {
  showFog = !showFog; // Invert showFog 
  debug("Show Fog set to: " + showFog);
}

function resetPlane() {
  debug("Resetting plane");

  glMatrix.vec3.copy(camPosition, kInitPosition);
  camSpeed = kInitSpeed;

  camOrientation = glMatrix.quat.create();
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

  // We only need the one shader program for this rendering, so we can just
  // bind it as the current program here.
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
  shaderProgram.locations.drawingPolygon = 
    gl.getUniformLocation(shaderProgram, "drawingPolygon");

  shaderProgram.locations.minZ = 
    gl.getUniformLocation(shaderProgram, "minZ");
  shaderProgram.locations.maxZ = 
    gl.getUniformLocation(shaderProgram, "maxZ");
  
  shaderProgram.locations.lightPosition =
    gl.getUniformLocation(shaderProgram, "lightPosition");
  shaderProgram.locations.ambientLightColor =
    gl.getUniformLocation(shaderProgram, "ambientLightColor");
  shaderProgram.locations.diffuseLightColor =
  gl.getUniformLocation(shaderProgram, "diffuseLightColor");
  shaderProgram.locations.specularLightColor =
  gl.getUniformLocation(shaderProgram, "specularLightColor");

  shaderProgram.locations.fogColor = 
    gl.getUniformLocation(shaderProgram, "fogColor");
  shaderProgram.locations.fogDensity = 
    gl.getUniformLocation(shaderProgram, "fogDensity");
  shaderProgram.locations.toggleFog = 
    gl.getUniformLocation(shaderProgram, "toggleFog");
}

/**
 * Draws the terrain to the screen.
 */
function draw() {
  // Transform the clip coordinates so the render fills the canvas dimensions.
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  // Clear the color buffer and the depth buffer.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Generate the projection matrix using perspective projection.
  const near = 0.1;
  const far = 200.0;
  glMatrix.mat4.perspective(projectionMatrix, degToRad(45), 
                            gl.viewportWidth / gl.viewportHeight,
                            near, far);
  
  // Perform the camera computations based on camOrientation and camPosition
  const lookAtPt = glMatrix.vec3.create(); glMatrix.vec3.add(lookAtPt, camPosition, camDirection);
  const up = glMatrix.vec3.fromValues(0.0, 1.0, 0.0);
  glMatrix.vec3.transformQuat(up, up, camOrientation);
  glMatrix.mat4.lookAt(modelViewMatrix, camPosition, lookAtPt, up);

  setMatrixUniforms();
  setLightUniforms(ambientLightColor, diffuseLightColor, specularLightColor,
                   lightPosition);
  setFogUniforms(); 

  // Set the min/max Z uniforms for the height mapping 
  gl.uniform1f(shaderProgram.locations.minZ, myTerrain.getZVertexMin());
  gl.uniform1f(shaderProgram.locations.maxZ, myTerrain.getZVertexMax());

  
  // Draw the triangles, the wireframe, or both, based on the render selection.
  if (document.getElementById("polygon").checked) { 
    setMaterialUniforms(shininess, kSpecular); 
    myTerrain.drawTriangles(shaderProgram);
  }
  else if (document.getElementById("wirepoly").checked) {
    setMaterialUniforms(shininess, kSpecular); 
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1, 1);
    myTerrain.drawTriangles(shaderProgram);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    setMaterialUniforms(shininess, kEdgeBlack, kEdgeBlack, kEdgeBlack);
    myTerrain.drawEdges(shaderProgram);
  }
  else if (document.getElementById("wireframe").checked) {
    setMaterialUniforms(shininess, kEdgeBlack, kEdgeBlack, kEdgeBlack);
    myTerrain.drawEdges(shaderProgram);
  }
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
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} s Specular material color.
 * @param {Float32Array} a Ambient material color, optional
 * @param {Float32Array} d Diffuse material color, optional 
 */
function setMaterialUniforms(alpha, s, a=null, d=null) {
  if (a !== null) {
    gl.uniform3fv(shaderProgram.locations.kAmbient, a);
  }
  if (d !== null) {
    gl.uniform3fv(shaderProgram.locations.kDiffuse, d);
  }
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

/**
 * Send the Fog color and density to the shader 
 */
function setFogUniforms() {
  gl.uniform4fv(shaderProgram.locations.fogColor, kBackgroundColor);
  gl.uniform1f(shaderProgram.locations.fogDensity, kFogDensity);

  gl.uniform1f(shaderProgram.locations.toggleFog, showFog);
}

/**
 * Animates...allows user to change the geometry view between
 * wireframe, polgon, or both.
 */
 function animate(currentTime) {
  // Flight simulator 
  handleKeyPress();
  handlePlaneChanges(); 

  // Draw the frame.
  draw();
  // Animate the next frame. 
  requestAnimationFrame(animate);
}
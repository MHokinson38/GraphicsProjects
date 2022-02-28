/**
 * @file  MP1, draws either an animated Block I or a unique animation of a donut (torus) 
 * @author Matt Hokinson <mkh7@eillinois.edu>
 * 
 * Updated Spring 2021 to use WebGL 2.0 and GLSL 3.00
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global The WebGL buffer holding the  block I */
var vertexPositionBuffer;

/** @global The WebGL buffer holding the vertex colors */
var vertexColorBuffer;

/** @global The vertex array object for the  block I */
var blockIVAO;

/** @global The VAO for the bouncing ball */
var bouncingBallVAO;

/** @global The rotation angle of our block I  */
var rotAngle = 0;

/** @global The param we are scaling the block I, will range from .5 to 2 */
var scaleParam = 1;

/** @global The direction we are currently scaling (either up or down) */
var scaleDirection = 1;

/** @global The current line we are moving about on the square */
var current_square_vertex = 0;

/** @global The current step we are at when moving about the square */
var current_square_step = 0;

/** @global How many frames are we spending on each side of the square */
var NUM_STEPS_ALONG_SQUARE = 250;

/** @global Number of vertices about the radius for the ball in the triangle fan */
var NUMBER_OF_BALL_VERTICES = 125;

/** @global Radius of the ball to place the vertices about */
var BALL_RADIUS = .25;

/** @global Initial center of the bouncing ball */
var ball_center = [0.0, 0.0, 0.0]; // Start at the origin 

/** @global Initial velocity of the  ball*/
var ball_velocity = [.5, .8666]; // Approx 30 degrees to the upper right 

/** @global The ModelView matrix contains any modeling and viewing transformations */
var modelViewMatrix = glMatrix.mat4.create();

/** @global Records time last frame was rendered */
var previousTime = 0;

/** @global Which animation to display (ball or block_i) */
var displayBlockI = true;

/** @global The current animation frame (so we can cancel on context switch)*/
var animation_frame;


/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}


/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
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
 * Loads a shader.
 * Retrieves the source code from the HTML document and compiles it.
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
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
 * Set up the fragment and vertex shaders.
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

  // We only use one shader program for this example, so we can just bind
  // it as the current program here.
  gl.useProgram(shaderProgram);
    
  // Query the index of each attribute in the list of attributes maintained
  // by the GPU. 
  shaderProgram.vertexPositionAttribute =
    gl.getAttribLocation(shaderProgram, "aVertexPosition");
  shaderProgram.vertexColorAttribute =
    gl.getAttribLocation(shaderProgram, "aVertexColor");
    
  //Get the index of the Uniform variable as well
  shaderProgram.modelViewMatrixUniform =
    gl.getUniformLocation(shaderProgram, "uModelViewMatrix");
}

/**
 * Setup the buffers for displaying the block I 
 */
function generate_block_i_buffer() {
  // Define a triangle in clip coordinates.
  // Offsets relative to the origin 
  var block_i_strip = [
    -0.4, 0.6, 0.0,
    -0.4, 0.3, 0.0,
    -0.15, 0.3, 0.0,  // 1 
    -0.4, 0.6, 0.0,
    -0.15, 0.3, 0.0,
     0.4, 0.6, 0.0,  // 2
    -0.15, 0.3, 0.0,
     0.15, 0.3, 0.0,
     0.4, 0.6, 0.0,  // 3
     0.15, 0.3, 0.0,
     0.4, 0.3, 0.0,
     0.4, 0.6, 0.0,  // 4
    -0.15, 0.3, 0.0,
     0.15, 0.3, 0.0,
    -0.15, -0.3, 0.0, // 5
     0.15, 0.3, 0.0,
     0.15, -0.3, 0.0,
    -0.15, -0.3, 0.0, // 6
    -0.4, -0.3, 0.0,
    -0.15, -0.3, 0.0,
    -0.4, -0.6, 0.0, // 7
    -0.15, -0.3, 0.0,
    -0.4, -0.6, 0.0,
     0.4, -0.6, 0.0, // 8
    -0.15, -0.3, 0.0,
     0.15, -0.3, 0.0,
     0.4, -0.6, 0.0, // 9
     0.15, -0.3, 0.0,
     0.4, -0.3, 0.0,
     0.4, -0.6, 0.0, // 10
  ];

  let square_vertices = [
    .3, .3,
    -.3, .3,
    -.3, -.3,
    .3, -.3,
  ]

  var transformed_vertices = []
  // Generate the new vertices as they move about the square 
  // First, interpolate the current indices between the current and next index 
  let nextIndex = (current_square_vertex + 1) % 4;
  let x_step = (square_vertices[nextIndex * 2] - square_vertices[current_square_vertex * 2]) / NUM_STEPS_ALONG_SQUARE;
  let y_step = (square_vertices[nextIndex * 2 + 1] - square_vertices[current_square_vertex * 2 + 1]) / NUM_STEPS_ALONG_SQUARE;
  let center_x = square_vertices[current_square_vertex * 2] + x_step * current_square_step;
  let center_y = square_vertices[current_square_vertex * 2 + 1] + y_step * current_square_step;;
  console.log("Current step about the square: " + x_step + ", " + y_step);

  for (let i = 0; i < block_i_strip.length; i += 3) {
  transformed_vertices.push(block_i_strip[i] + center_x);
  transformed_vertices.push(block_i_strip[i + 1] + center_y);
  transformed_vertices.push(block_i_strip[i + 2]);
  }

  // Populate the buffer with the position data.
  // Using dynamic draw because we are changing the vertices each frame
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer); // Bind the right buffer before adding data
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(transformed_vertices), gl.DYNAMIC_DRAW);
  vertexPositionBuffer.itemSize = 3; // Size of the vertices (3 since 3 dimensions) 
  vertexPositionBuffer.numberOfItems = 30; // Not the number of triangle, but total vertices 

  // Binds the buffer that we just made to the vertex position attribute.
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
                      vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  var colors = [
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
    252/255.0, 151/255.0, 0.0, 1.0,
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer); // Bind the color buffer before adding data 
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  vertexColorBuffer.itemSize = 4;
  vertexColorBuffer.numItems = 30;  
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, 
                        vertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
}

/**
 * Setup the buffer for the bouncing ball (which basically stores a center and 
 * redirects when we hit a wall (by checking a radius))
 */
function generate_bouncing_ball_buffer() {
  // Generate a vertice list for triangle fan with N triangles (dividing 2pi by N and calculating points)
  var ball_vertice_fan = [ball_center[0], ball_center[1], ball_center[2]];
  for (let i = 0; i <= NUMBER_OF_BALL_VERTICES; ++i) {
    // Find the angle 
    let current_angle = (2 * Math.PI / NUMBER_OF_BALL_VERTICES) * i;
    let rim_x = BALL_RADIUS * Math.cos(current_angle) + ball_center[0];
    let rim_y = BALL_RADIUS * Math.sin(current_angle) + ball_center[1];

    ball_vertice_fan.push(rim_x);
    ball_vertice_fan.push(rim_y);
    ball_vertice_fan.push(0.0);
  }
  console.log(BALL_RADIUS);
  console.log(ball_vertice_fan);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer); // Bind the right buffer before adding data
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ball_vertice_fan), gl.DYNAMIC_DRAW);
  vertexPositionBuffer.itemSize = 3; // Size of the vertices (3 dimensions) 
  vertexPositionBuffer.numberOfItems = 2 + NUMBER_OF_BALL_VERTICES; // Not the number of triangle, but total vertices 

  // Binds the buffer that we just made to the vertex position attribute.
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 
    vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Do the colors 
  var colors = [252/255.0, 151/255.0, 0.0, 1.0]; // Do orange in the center, then gradient to blue outside?
  for (let i = 0; i <= NUMBER_OF_BALL_VERTICES; ++i) {
    colors.push(26/255.0);
    colors.push(93/255.0);
    colors.push(237/255.0);
    colors.push(1.0);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer); // Bind the color buffer before adding data 
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
  vertexColorBuffer.itemSize = 4;
  vertexColorBuffer.numItems = 2 + NUMBER_OF_BALL_VERTICES;  
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, 
                        vertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);
}

/**
 * Set up the buffers to hold the triangle's vertex positions and colors.
 */
function setupBuffers() {
    
  // Create the vertex array object, which holds the list of attributes for
  // the triangle.
  blockIVAO = gl.createVertexArray();
  bouncingBallVAO = gl.createVertexArray();

  // Create a buffer for positions, and bind it to the vertex array object.
  vertexPositionBuffer = gl.createBuffer();
  
  // Do the same steps for the color buffer.
  vertexColorBuffer = gl.createBuffer();

  if (displayBlockI) {
    console.log("binding the thing");
    gl.bindVertexArray(blockIVAO); 
    generate_block_i_buffer();
  } else {
    gl.bindVertexArray(bouncingBallVAO);
    generate_bouncing_ball_buffer();
  }
    
   // Enable each attribute we are using in the VAO.  
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
    
  // Unbind the vertex array object to be safe.
  gl.bindVertexArray(null);
}


/**
 * Draws a frame to the screen.
 */
function draw() {
  // Transform the clip coordinates so the render fills the canvas dimensions.
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

  // Clear the screen.
  gl.clear(gl.COLOR_BUFFER_BIT);
    
  // Send the ModelView matrix with our transformations to the vertex shader.
  gl.uniformMatrix4fv(shaderProgram.modelViewMatrixUniform,
                      false, modelViewMatrix);
    
  // Render the block I or "circle"
  if (displayBlockI) {
    gl.bindVertexArray(blockIVAO);
    gl.drawArrays(gl.TRIANGLES, 0, vertexPositionBuffer.numberOfItems);
  } else {
    gl.bindVertexArray(bouncingBallVAO);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertexPositionBuffer.numberOfItems);
  }
  
  // Unbind the vertex array object to be safe.
  gl.bindVertexArray(null);
}

/**
 * Animate the block I which moves around an invisible box while scaling up and down and rotating 
 * @param {float} deltaTime Time step 
 * @param {float} speed Value from slider to determine step size in animations
 */
function animate_block_i(deltaTime, speed) {
  // Update geometry to rotate 'speed' degrees per second.
  rotAngle += speed * deltaTime;
  if (rotAngle > 360.0)
      rotAngle = 0.0;

  current_square_step += 1;
  if (current_square_step > NUM_STEPS_ALONG_SQUARE) {
    current_square_vertex = (current_square_vertex + 1) % 4;
    current_square_step = 0;
  }

  scaleParam += (speed / 100) * deltaTime * scaleDirection;
  if (scaleParam > 1.25) 
    scaleDirection = -1;
  else if (scaleParam < .5) 
    scaleDirection = 1;

  let radianAngle = rotAngle * Math.PI / 180;
  let rottato_pottato = glMatrix.quat.fromValues(Math.sin(radianAngle / 2) * 0, // Right now, just the z axis  
                                            Math.sin(radianAngle / 2) * 0,
                                            Math.sin(radianAngle / 2) * 1,
                                            Math.cos(radianAngle / 2));

  glMatrix.mat4.fromRotationTranslationScale(modelViewMatrix, 
                                            rottato_pottato,
                                            [0, 0, 0],
                                            [scaleParam, scaleParam, scaleParam]);
}

/**
 * Animate the boucning ball (check for wall collisions and move the ball center)
 * @param {float} deltaTime Time step  
 */
function animate_bouncing_ball(deltaTime) {
  // Check for collisions (Ensure we are moving towards the wall as well)
  if ((ball_center[0] + BALL_RADIUS > 1 && ball_velocity[0] > 0) ||
      (ball_center[0] - BALL_RADIUS < -1.0 && ball_velocity[0] < 0)) {
        ball_velocity[0] *= -1;
      }
  if ((ball_center[1] + BALL_RADIUS > 1 && ball_velocity[1] > 0) ||
      (ball_center[1] - BALL_RADIUS < -1.0 && ball_velocity[1] < 0)) {
        ball_velocity[1] *= -1;
      }

  // Move the center along 
  ball_center[0] += deltaTime * ball_velocity[0];
  ball_center[1] += deltaTime * ball_velocity[1];
} 

function reset_bouncing_ball() {
  ball_center = [0,0,0];
}

/**
 * Notes: For changing the animations 
 * At startup and thereafter, check to see which is selected and do what I was doing before 
 * Make two different VAO's, and switch between the two when I'm choosing the animation to do 
 */

/**
 * Animates the triangle by updating the ModelView matrix with a rotation
 * each frame.
 */
 function animate(currentTime) {
  // Read the speed slider from the web page.
  var speed = document.getElementById("speed").value;

  // Convert the time to seconds.
  currentTime *= 0.001;
  // Subtract the previous time from the current time.
  let deltaTime = currentTime - previousTime;
  // Remember the current time for the next frame.
  previousTime = currentTime;

  if (displayBlockI) {
    animate_block_i(deltaTime, speed);
  } else {
    animate_bouncing_ball(deltaTime * (speed/100.0));
  }
  
  setupBuffers(); // This is unecessary in the original code 

  // Draw the frame.
  draw();
  
  // Animate the next frame. The animate function is passed the current time in
  // milliseconds.
  animation_frame = requestAnimationFrame(animate);
}

/**
 * Switch the animation which is being shown (based on which button is hit)
 */
function on_context_switch() {
  displayBlockI = !displayBlockI;
  
  modelViewMatrix = glMatrix.mat4.create();
  reset_bouncing_ball();

  startup();
  cancelAnimationFrame(animation_frame);
}


/**
 * Startup function called from html code to start the program.
 */
 function startup() {
  console.log("Starting animation...");
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders(); 
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  animation_frame = requestAnimationFrame(animate); 
}


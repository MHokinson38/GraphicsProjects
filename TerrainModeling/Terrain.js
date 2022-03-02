/**
 * @file Terrain.js - A simple 3D terrain model for WebGL
 * @author Ian Rudnick <itr2@illinois.edu>
 * @brief Starter code for CS 418 MP2 at the University of Illinois at
 * Urbana-Champaign.
 *
 * Updated Spring 2021 for WebGL 2.0/GLSL 3.00 ES.
 *
 * You'll need to implement the following functions:
 * setVertex(v, i) - convenient vertex access for 1-D array
 * getVertex(v, i) - convenient vertex access for 1-D array
 * generateTriangles() - generate a flat grid of triangles
 * shapeTerrain() - shape the grid into more interesting terrain
 * calculateNormals() - calculate normals after warping terrain
 *
 * Good luck! Come to office hours if you get stuck!
 */

 class Terrain {
    /**
     * Initializes the members of the Terrain object.
     * @param {number} div Number of triangles along the x-axis and y-axis.
     * @param {number} minX Minimum X coordinate value.
     * @param {number} maxX Maximum X coordinate value.
     * @param {number} minY Minimum Y coordinate value.
     * @param {number} maxY Maximum Y coordinate value.
     */
    constructor(div, minX, maxX, minY, maxY) {
        this.div = div;
        this.minX = minX;
        this.minY = minY;
        this.maxX = maxX;
        this.maxY = maxY;

        this.Rval = 2; // For terrain generation, anything with distance over 2 from line is not changed
        this.minZCoor = null;
        this.maxZCoor = null; // memoize values to avoid multiple computations 

        // Allocate the vertex array
        this.positionData = [];
        // Allocate the normal array.
        this.normalData = [];
        // Allocate the triangle array.
        this.faceData = [];
        // Allocate an array for edges so we can draw a wireframe.
        this.edgeData = [];
        console.log("Terrain: Allocated buffers");

        this.generateTriangles();
        console.log("Terrain: Generated triangles");

        this.generateLines();
        console.log("Terrain: Generated lines");

        this.shapeTerrain();
        console.log("Terrain: Sculpted terrain");

        this.calculateNormals();
        console.log("Terrain: Generated normals");

        // You can use this function for debugging your buffers:
        // this.printBuffers();
    }


    //-------------------------------------------------------------------------
    // Vertex access and triangle generation - your code goes here!
    /**
     * Set the x,y,z coords of the ith vertex
     * @param {Object} v An array of length 3 holding the x,y,z coordinates.
     * @param {number} i The index of the vertex to set.
     */
    setVertex(v, i) {
        if (i < 0 || i >= this.positionData.length) {
            console.log("Invalid vertex index in setVertex: " + i);
        }

        this.positionData[i*3]     = v[0];
        this.positionData[i*3 + 1] = v[1];
        this.positionData[i*3 + 2] = v[2];
    }


    /**
     * Returns the x,y,z coords of the ith vertex.
     * @param {Object} v An array of length 3 to hold the x,y,z coordinates.
     * @param {number} i The index of the vertex to get.
     */
    getVertex(v, i) {
        if (i < 0 || i >= this.positionData.length) {
            console.log("Invalid vertex index in getVertex: " + i);
        }

        v[0] = this.positionData[i*3];
        v[1] = this.positionData[i*3 + 1];
        v[2] = this.positionData[i*3 + 2];
    }

    /**
     * Makes call to getVertexExtrema for Z coor and stores result to avoid 
     * repeated computation 
     * @returns Min Z Value in Mesh 
     */
    getZVertexMin() {
        if (!this.positionData) { // Particle data might not be set for the first call
            return -1;
        }
        if (this.minZCoor == null) {
            this.minZCoor = this.getVertexExtrema((curr, next) => next < curr, 2);
        } 
        return this.minZCoor;
    }

    /**
     * Makes call to getVertexExtrema for Z coor and stores result to avoid 
     * repeated computation 
     * @returns Max Z Value in Mesh 
     */
    getZVertexMax() {
        if (!this.positionData) { // Particle data might not be set for the first call
            return -1;
        }

        if (this.maxZCoor == null) {
            this.maxZCoor = this.getVertexExtrema((curr, next) => next > curr, 2);
        }
        return this.maxZCoor;
    }

    /**
     * Finds some extrema using a lambda comparator 
     * 
     * @param {Function} Comparator - How to compare indices 
     * @param {Int}      vIdx       - The index to search across (only really makes sense to search 3 (z)) 
     */
    getVertexExtrema(comparator, vIdx) {
        if (!this.positionData) { // For safety 
            return -1;
        }

        var res = null;
        for (var v = 0; v < this.numVertices; ++v) {
            var currV = v*3;
            if (res === null || comparator(this.positionData[currV + vIdx], res)) {
                res = this.positionData[currV + vIdx];
            }
        }
        
        return res;
    }


    /**
     * Generate the triangle and vertex data for the terrain
     * First generate the grid of vertices, then move through and generate triangle index buffer
     * Using existing vertices
     */
    generateTriangles() {
        // Set the vertices along the grid
        var xStep = (this.maxX - this.minX) / this.div;
        var yStep = (this.maxY - this.minY) / this.div;

        for (var y = this.minY; y <= this.maxY; y += yStep) {
            for (var x = this.minX; x <= this.maxX; x += xStep) {
                this.positionData.push(x);
                this.positionData.push(y);
                this.positionData.push(0); // Generating terrain plane on z=0
            }
        }

        var verticesPerRow = this.div + 1;

        // Generate the face matrix using the indices of the above vertex
        // Index 0 is going to be at minX,minY, and moving up moves first along the y, then x
        // Skip the last row (since they aren't the bottom left vertices of any boxes)
        for (var currRow = 0; currRow < verticesPerRow - 1; ++currRow) {
            var rowOffset = currRow * verticesPerRow;

            // Only going up to the last "box" (triangle pair), which doesn't include final x vertex on row as left side
            for (var xRowIdx = 0; xRowIdx < verticesPerRow - 1; ++xRowIdx) {
                // Add the triangle with two vertices on this row (lower left)
                this.faceData.push(rowOffset + xRowIdx);
                this.faceData.push(rowOffset + xRowIdx + 1);
                this.faceData.push(rowOffset + xRowIdx + verticesPerRow);

                // Add the triangle with one vertex on this row (Upper right)
                this.faceData.push(rowOffset + xRowIdx + 1);
                this.faceData.push(rowOffset + xRowIdx + 1 + verticesPerRow);
                this.faceData.push(rowOffset + xRowIdx + verticesPerRow);
            }
        }

        // We'll need these to set up the WebGL buffers.
        this.numVertices = this.positionData.length/3;
        this.numFaces = this.faceData.length/3;
    }


    /**
     * This function does nothing.
     */
    shapeTerrain() {
        var numFaultLines = 200;
        var delta = .025;
        var decay = .005;

        for (var i = 0; i < numFaultLines; ++i) {
            // Generate line point and normal for that point 
            var faultPoint = glMatrix.vec2.fromValues(Math.random() * (this.maxX - this.minX) - Math.abs(this.minX), Math.random() * (this.maxY - this.minY) - Math.abs(this.minY));

            var normalTheta = Math.random() * Math.PI * 2;
            var normal = glMatrix.vec2.fromValues(Math.cos(normalTheta), Math.sin(normalTheta));

            // Modify all points 
            for (var currPoint = 0; currPoint < this.numVertices; ++currPoint) {
                this.shapeTheEarth(faultPoint, normal, currPoint, delta);
            }

            delta = delta / (2**decay); // Slowly decrease delta as we make many passes 
        }
    }

    /**
     * Performs terrain modification on a single point 
     */
    shapeTheEarth(faultPoint, faultNormal, currPoint, delta) {
        var vertex = glMatrix.vec3.create();
        this.getVertex(vertex, currPoint);
        
        var vertexXY = glMatrix.vec2.fromValues(vertex[0], vertex[1]);
        var toPoint = glMatrix.vec2.create(); glMatrix.vec2.subtract(toPoint, vertexXY, faultPoint);
        var distance = this.getLineDistance(toPoint, faultNormal);
        if (distance == -1) {
            return; // To far, do nothing
        }

        // Check the dot product to determine move up or down 
        var deltaDir = glMatrix.vec2.dot(toPoint, faultNormal) >= 0 ? 1 : -1;

        var zMod = delta * deltaDir * (1 - (distance / this.Rval)**2)**2;

        var modVertex = glMatrix.vec3.fromValues(vertex[0], vertex[1], vertex[2] + zMod);
        this.setVertex(modVertex, currPoint);
    }

    /**
     * Get distance to line, -1 if beyond the upper range bound for fault lines 
     */ 
    getLineDistance(toPoint, faultNormal) {
        var faultDirection = glMatrix.vec2.fromValues(faultNormal[1], -1 * faultNormal[0]); // 90  degree rotation CW 

        var crossProd = glMatrix.vec3.create(); glMatrix.vec2.cross(crossProd, toPoint, faultDirection);
        var distance = glMatrix.vec3.len(crossProd); // Since faultNormal is unit length, we don't need to divide 

        return distance > this.Rval ? -1 : distance;
    }


    /**
     * Calculate normals for the faces (Using Per-Vertex normals) 
     * 
     */
    calculateNormals() {
        // Init normal array to 0's for each vertex (3*numVertices)
        this.normalData = new Array(this.positionData.length).fill(0);
        
        // Loop through all of the faces, and calculate the normal for that face using (v2-v1)X(v3-v1) 
        for (var f = 0; f < this.faceData.length/3; f++) {
            var fid = f*3;
            var v1_idx = this.faceData[fid];        // These are the indices we will use for the normals as well 
            var v2_idx= this.faceData[fid + 1];
            var v3_idx = this.faceData[fid + 2];

            var v1 = glMatrix.vec3.create(); this.getVertex(v1, v1_idx);
            var v2 = glMatrix.vec3.create(); this.getVertex(v2, v2_idx);
            var v3 = glMatrix.vec3.create(); this.getVertex(v3, v3_idx);

            var v2v1 = glMatrix.vec3.create(); glMatrix.vec3.subtract(v2v1, v2, v1);
            var v3v1 = glMatrix.vec3.create(); glMatrix.vec3.subtract(v3v1, v3, v1);
            var normal = glMatrix.vec3.create(); glMatrix.vec3.cross(normal, v2v1, v3v1);

            // Add the normal to each vertex normal (normalize as we go)
            this.appendVertexNormals(v1_idx, normal);
            this.appendVertexNormals(v2_idx, normal);
            this.appendVertexNormals(v3_idx, normal);
        }   
    }

    /**
     * Adds and normalizes a new normal to the normal vector (Per-Vertex Normals)
     * 
     * @param {Int}    Index  - Index of the vertex normal to modify 
     * @param {Object} Normal - Next face normal to add to the specified vertex index 
     */
    appendVertexNormals(idx, normal) {
        // Fetch the index values and add to new normal, and create a new vector (to normalize easily) 
        var newVertNorm = glMatrix.vec3.fromValues(this.normalData[idx*3] + normal[0],
                                                   this.normalData[idx*3 + 1] + normal[1],
                                                   this.normalData[idx*3 + 2] + normal[2]);
        var newNormMag = glMatrix.vec3.len(newVertNorm);

        this.normalData[idx*3] = newVertNorm[0] / newNormMag;
        this.normalData[idx*3 + 1] = newVertNorm[1] / newNormMag;
        this.normalData[idx*3 + 2] = newVertNorm[2] / newNormMag;
    }

    //-------------------------------------------------------------------------
    // Setup code (run once)
    /**
     * Generates line data from the faces in faceData for wireframe rendering.
     */
    generateLines() {
        for (var f = 0; f < this.faceData.length/3; f++) {
            // Calculate index of the face
            var fid = f*3;
            this.edgeData.push(this.faceData[fid]);
            this.edgeData.push(this.faceData[fid+1]);

            this.edgeData.push(this.faceData[fid+1]);
            this.edgeData.push(this.faceData[fid+2]);

            this.edgeData.push(this.faceData[fid+2]);
            this.edgeData.push(this.faceData[fid]);
        }
    }


    /**
     * Sets up the WebGL buffers and vertex array object.
     * @param {object} shaderProgram The shader program to link the buffers to.
     */
    setupBuffers(shaderProgram) {
        // Create and bind the vertex array object.
        this.vertexArrayObject = gl.createVertexArray();
        gl.bindVertexArray(this.vertexArrayObject);

        // Create the position buffer and load it with the position data.
        this.vertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positionData),
                      gl.STATIC_DRAW);
        this.vertexPositionBuffer.itemSize = 3;
        this.vertexPositionBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.vertexPositionBuffer.numItems, " vertices.");

        // Link the position buffer to the attribute in the shader program.
        gl.vertexAttribPointer(shaderProgram.locations.vertexPosition,
                               this.vertexPositionBuffer.itemSize, gl.FLOAT,
                               false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.locations.vertexPosition);

        // Specify normals to be able to do lighting calculations
        this.vertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.normalData),
                      gl.STATIC_DRAW);
        this.vertexNormalBuffer.itemSize = 3;
        this.vertexNormalBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.vertexNormalBuffer.numItems, " normals.");

        // Link the normal buffer to the attribute in the shader program.
        gl.vertexAttribPointer(shaderProgram.locations.vertexNormal,
                               this.vertexNormalBuffer.itemSize, gl.FLOAT,
                               false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.locations.vertexNormal);

        // Set up the buffer of indices that tells WebGL which vertices are
        // part of which triangles.
        this.triangleIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.faceData),
                      gl.STATIC_DRAW);
        this.triangleIndexBuffer.itemSize = 1;
        this.triangleIndexBuffer.numItems = this.faceData.length;
        console.log("Loaded ", this.triangleIndexBuffer.numItems / 3, " triangles.");

        // Set up the index buffer for drawing edges.
        this.edgeIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.edgeData),
                      gl.STATIC_DRAW);
        this.edgeIndexBuffer.itemSize = 1;
        this.edgeIndexBuffer.numItems = this.edgeData.length;

        // Unbind everything; we want to bind the correct element buffer and
        // VAO when we want to draw stuff
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
    }


    //-------------------------------------------------------------------------
    // Rendering functions (run every frame in draw())
    /**
     * Renders the terrain to the screen as triangles.
     * 
     * @param {object} shaderProgram The shader program to indicate what is being drawn 
     */
    drawTriangles(shaderProgram) {
        gl.uniform1f(shaderProgram.locations.drawingPolygon, 1);
        gl.bindVertexArray(this.vertexArrayObject);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
        gl.drawElements(gl.TRIANGLES, this.triangleIndexBuffer.numItems,
                        gl.UNSIGNED_INT,0);
    }


    /**
     * Renders the terrain to the screen as edges, wireframe style.
     * 
     * @param {object} shaderProgram The shader program to indicate what is being drawn 
     */
    drawEdges(shaderProgram) {
        gl.uniform1f(shaderProgram.locations.drawingPolygon, -1);
        gl.bindVertexArray(this.vertexArrayObject);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);
        gl.drawElements(gl.LINES, this.edgeIndexBuffer.numItems,
                        gl.UNSIGNED_INT,0);
    }


    //-------------------------------------------------------------------------
    // Debugging
    /**
     * Prints the contents of the buffers to the console for debugging.
     */
    printBuffers() {
        for (var i = 0; i < this.numVertices; i++) {
            console.log("v ", this.positionData[i*3], " ",
                              this.positionData[i*3 + 1], " ",
                              this.positionData[i*3 + 2], " ");
        }
        for (var i = 0; i < this.numVertices; i++) {
            console.log("n ", this.normalData[i*3], " ",
                              this.normalData[i*3 + 1], " ",
                              this.normalData[i*3 + 2], " ");
        }
        for (var i = 0; i < this.numFaces; i++) {
            console.log("f ", this.faceData[i*3], " ",
                              this.faceData[i*3 + 1], " ",
                              this.faceData[i*3 + 2], " ");
        }
    }

} // class Terrain

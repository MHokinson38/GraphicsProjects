/**
 * @fileoverview Particle.js - Class for storing information about Particles 
 * @author Matt Hokinson <mkh7@illinois.edu>
 */

//======== Forces (Accelerations) on particle, and Collision constants  =========
/** @global Gravity acceleration */
const gravity = glMatrix.vec3.fromValues(0,-9.8,0);
/** @global Drag Coeff */
const dragCoef = .6;
/** @global  Collision absorption  */
const absorption = .9; 

/** @global Wall normals for collision */
const wallNormals = [
    glMatrix.vec3.fromValues(1,0,0),  // Left X 
    glMatrix.vec3.fromValues(-1,0,0), // Right X 
    glMatrix.vec3.fromValues(0,1,0),  // Lower Y 
    glMatrix.vec3.fromValues(0,-1,0), // Upper Y
    glMatrix.vec3.fromValues(0,0,1),  // Back Z 
    glMatrix.vec3.fromValues(0,0,-1), // Front Z 
];
/** @global Floor wall normal index */
const floorIndex = 2;
/** @global Velocity floor */
const velocityFloor = .01;

 class Particle {
    /**
     * Creates a particle object and stores relevant information .
     * @param {vec3} Position Position 
     * @param {vec3} Velocity Velocity 
     * @param {vec3} Color Color 
     * @param {float} Radius Madius  
     * @param {float} Mass Mass 
     */
    constructor(position, velocity, color, radius, mass)
    {
        this.position = position;
        this.velocity = velocity;
        this.color = color;
        this.radius = radius;
        this.mass = mass;
        this.done = false;

        this.collide = this.collide.bind(this); // Thanks Stackoverflow, apparently this fixes 'this' binding issue
    }

    consoleDisplay() {
        console.log(`ParticleInfo------------\n
                    Position: ${this.position}\n
                    Velocity: ${this.velocity}\n
                    Color: ${this.color}\n
                    Radius: ${this.radius}\n
                    Mass: ${this.mass}\n`);
    }

    /**
     * Order of updates/checks as follows:
     *  1. Update the velocity based on forces acting on the particle 
     *  2. Update the new possible position 
     *  3. Use this position to check for collisions
     *      3.1. If there is a new collision, then we find the time until collision, and then move the \
     *           particle to that point, and update the velocity to reflect the hit 
     *      3.2. We are then going to move the particle with the new velocity * (deltaT - collisionT) 
     *  4. Once we have the new position (either changed or unchanged), we set this.position to the new 
     *     position found by collision detection 
     * @param {float} deltaT 
     */
    update(deltaT) {
        if (this.done) {
            return;
        }

        // console.log(`Updating the particle...`);

        this.updateVelocity(deltaT);
        var newPos = this.updatePosition(deltaT);

        // Collision check 
        var collisionRes = this.collide(this.position, newPos, chamberSize, deltaT);

        this.position = glMatrix.vec3.clone(collisionRes.newPos);
        this.velocity = glMatrix.vec3.clone(collisionRes.newVel);
        // console.log(`New velocity: ${this.velocity}`);
        // console.log(`New position: ${this.position}`);
    }

    updateVelocity(deltaT) {
        var deltaVel = glMatrix.vec3.fromValues(0,0,0);

        // Gravity 
        glMatrix.vec3.add(deltaVel, deltaVel, gravity);
        glMatrix.vec3.scale(deltaVel, deltaVel, deltaT);
        glMatrix.vec3.add(this.velocity, this.velocity, deltaVel);

        // Drag 
        glMatrix.vec3.scale(this.velocity, this.velocity, Math.pow(dragCoef, deltaT));
    }

    /**
     * This is going to propose a new position before doing collision detection, so the 
     * position will not be set directly. If there is a collision, the detector will return a new 
     * position, which has been adjusted, to use instead. It will also return the new velocity to use. 
     * @param {Float} deltaT 
     */
    updatePosition(deltaT) {
        var newPos = glMatrix.vec3.create();
        var deltaPos = glMatrix.vec3.create();

        glMatrix.vec3.scale(deltaPos, this.velocity, deltaT);
        glMatrix.vec3.add(newPos, this.position, deltaPos);

        return newPos;
    }

    /**
     * Handles Barrier collisions between particles and bounding box 
     * Going to look at the new position given no collision, and if there is one, 
     * we update the position of the new position given the old position and the collision time 
     * @param {Vec3} oldPosition
     * @param {Vec3} newPosition 
     * @param {Float} bound - The lower (-bound) and upper bound of the container  
     */
    collide(oldPosition, newPosition, bound, deltaT) {
        var collisionT = Infinity;
        var wallN = undefined;

        var radius = this.radius; // Foreach loop not happy with this binding I guess
        var velocity = glMatrix.vec3.clone(this.velocity);

        newPosition.forEach(function (pos, index) {
            if ((pos + radius) > bound && velocity[index] > 0) {
                var tempCollisionT = ((bound - radius) - oldPosition[index]) / velocity[index];

                if (tempCollisionT < collisionT) {
                    collisionT = tempCollisionT;
                    wallN = glMatrix.vec3.clone(wallNormals[index*2 + 1]);
                }
            }
            else if ((pos - radius) < -1* bound && velocity[index] < 0) {
                var tempCollisionT = ((-1*bound + radius) - oldPosition[index]) / velocity[index];

                if (tempCollisionT < collisionT) {
                    collisionT = tempCollisionT;
                    wallN = glMatrix.vec3.clone(wallNormals[index*2]);
                }
            }
        });
        
        var collisionDetected = collisionT !== Infinity;
        var adjustedPos = glMatrix.vec3.clone(newPosition); // In case no collision, no change in pos
        var v2 = glMatrix.vec3.clone(this.velocity); 

        // Take the min collision time, and modify the new position of the particle and return it
        // If there is no collision, then we don't change the new position 
        if (collisionDetected) { // Update the new position for return 
            var deltaColl = glMatrix.vec3.create();
            glMatrix.vec3.scale(deltaColl, this.velocity, collisionT); // tv 
            glMatrix.vec3.add(adjustedPos, oldPosition, deltaColl); // o + tv 

            // We also need the normal of the wall which we collided with for velocity update 
            // Computing the new velocity v' gives us: v' = v0 - 2(v0 * n) n
            // Then, normalize v' to have magnitude c * ||v0|| 
            var dot = glMatrix.vec3.dot(this.velocity, wallN);
            glMatrix.vec3.scale(v2, wallN, 2 * dot);
            glMatrix.vec3.subtract(v2, this.velocity, v2);

            // Normalize the output 
            glMatrix.vec3.scale(v2, v2, absorption);

            // Move the particle along by the remainding time after the collision 
            var remainderDeltaPos = glMatrix.vec3.create();
            glMatrix.vec3.scale(remainderDeltaPos, v2, deltaT - collisionT);
            glMatrix.vec3.add(adjustedPos, remainderDeltaPos, adjustedPos);

            if (glMatrix.vec3.length(v2) < velocityFloor && wallN[1] == 1) {
                this.done = true; // Ball is essentially not moving anymore
            }
         }

        return {
            newPos: adjustedPos,
            newVel: v2
        }
    }

    /**
     * Particle-Particle collision 
     * Why can't this be in a language other than js lmao 
     * @param {Particle} Other Second Particle  
     */
    particleCollide(other) {

    }
}   // class Particle;

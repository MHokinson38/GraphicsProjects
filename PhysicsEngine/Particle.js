/**
 * @fileoverview Particle.js - Class for storing information about Particles 
 * @author Matt Hokinson <itr2@illinois.edu>
 */

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
    }
}   // class Particle;

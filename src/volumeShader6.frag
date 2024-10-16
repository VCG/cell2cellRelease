precision highp float;
precision mediump sampler3D;

uniform vec3 u_size;
uniform int u_renderstyle;
uniform float u_renderthreshold;
uniform float u_renderthreshold2;
uniform float u_renderthreshold3;
uniform float u_renderthreshold4;
uniform float u_renderthreshold5;
uniform float u_renderthreshold6;
uniform vec2 u_clim;
uniform vec2 u_clim2;
uniform vec2 u_clim3;
uniform vec2 u_clim4;
uniform vec2 u_clim5;
uniform vec2 u_clim6;

uniform sampler3D u_data;
uniform sampler3D u_data2;
uniform sampler3D u_data3;
uniform sampler3D u_data4;
uniform sampler3D u_data5;
uniform sampler3D u_data6;

uniform sampler2D u_geo_depth;
uniform sampler2D u_geo_color;

uniform vec2 u_window_size;

uniform vec4 u_color;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform vec4 u_color4;
uniform vec4 u_color5;
uniform vec4 u_color6;

uniform float dt_scale;
uniform float dt_scale2;
uniform float dt_scale3;
uniform float dt_scale4;
uniform float dt_scale5;
uniform float dt_scale6;

uniform float u_camera_near;
uniform float u_camera_far;

varying vec3 v_position;
varying vec4 v_nearpos;
varying vec4 v_farpos;
varying vec2 vUv;

// The maximum distance through our rendering volume is sqrt(3).
const int MAX_STEPS = 887;// 887 for 512^3, 1774 for 1024^3
const int REFINEMENT_STEPS = 4;
const float relative_step_size = 1.0;
const vec4 ambient_color = vec4(0.2, 0.4, 0.2, 1.0);
const vec4 diffuse_color = vec4(0.8, 0.2, 0.2, 1.0);
const vec4 specular_color = vec4(1.0, 1.0, 1.0, 1.0);
const float shininess = 40.0;

void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);
void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray);

float sample1(vec3 texcoords);
float sample2(vec3 texcoords);
float sample3(vec3 texcoords);
float sample4(vec3 texcoords);
float sample5(vec3 texcoords);
float sample6(vec3 texcoords);
vec4 apply_colormap(float val);
vec4 apply_colormap2(float val);
vec4 apply_colormap3(float val);
vec4 apply_colormap4(float val);
vec4 apply_colormap5(float val);
vec4 apply_colormap6(float val);
vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray);
vec4 add_lighting2(float val, vec3 loc, vec3 step, vec3 view_ray);
vec4 add_lighting3(float val, vec3 loc, vec3 step, vec3 view_ray);
vec4 add_lighting4(float val, vec3 loc, vec3 step, vec3 view_ray);
vec4 add_lighting5(float val, vec3 loc, vec3 step, vec3 view_ray);
vec4 add_lighting6(float val, vec3 loc, vec3 step, vec3 view_ray);
float linearize_z(float z);


void main() {
    // Normalize clipping plane info
    vec3 farpos = v_farpos.xyz / v_farpos.w;
    vec3 nearpos = v_nearpos.xyz / v_nearpos.w;

    // Calculate unit vector pointing in the view direction through this fragment.
    vec3 view_ray = normalize(nearpos.xyz - farpos.xyz);

    // Compute the (negative) distance to the front surface or near clipping plane.
    // v_position is the back face of the cuboid, so the initial distance calculated in the dot
    // product below is the distance from near clip plane to the back of the cuboid
    float distance = dot(nearpos - v_position, view_ray);
    distance = max(distance, min((-0.5 - v_position.x) / view_ray.x,
    (u_size.x - 0.5 - v_position.x) / view_ray.x));
    distance = max(distance, min((-0.5 - v_position.y) / view_ray.y,
    (u_size.y - 0.5 - v_position.y) / view_ray.y));
    distance = max(distance, min((-0.5 - v_position.z) / view_ray.z,
    (u_size.z - 0.5 - v_position.z) / view_ray.z));

    // Now we have the starting position on the front surface
    vec3 front = v_position + view_ray * distance;

    // Decide how many steps to take
    int nsteps = int(-distance / relative_step_size + 0.5);
    if (nsteps < 1)
    discard;

    // Get starting location and step vector in texture coordinates
    vec3 step = ((v_position - front) / u_size) / float(nsteps);
    vec3 start_loc = front / u_size;

    // For testing: show the number of steps. This helps to establish
    // whether the rays are correctly oriented
    //'gl_FragColor = vec4(0.0, float(nsteps) / 1.0 / u_size.x, 1.0, 1.0);
    //'return;

    if (u_renderstyle == 0)
    cast_iso(start_loc, step, nsteps, view_ray);
    else if (u_renderstyle == 1)
    cast_dvr(start_loc, step, nsteps, view_ray);

    if (gl_FragColor.a < 0.05)
    discard;
}


float sample1(vec3 texcoords) {
    /* Sample float value from a 3D texture. Assumes intensity data. */
    return texture(u_data, texcoords.xyz).r;
}

float sample2(vec3 texcoords) {
    /* Sample float value from a 3D texture. Assumes intensity data. */
    return texture(u_data2, texcoords.xyz).r;
}

float sample3(vec3 texcoords) {
    /* Sample float value from a 3D texture. Assumes intensity data. */
    return texture(u_data3, texcoords.xyz).r;
}

float sample4(vec3 texcoords) {
        /* Sample float value from a 3D texture. Assumes intensity data. */
        return texture(u_data4, texcoords.xyz).r;
}

float sample5(vec3 texcoords) {
        /* Sample float value from a 3D texture. Assumes intensity data. */
        return texture(u_data5, texcoords.xyz).r;
}

float sample6(vec3 texcoords) {
        /* Sample float value from a 3D texture. Assumes intensity data. */
        return texture(u_data6, texcoords.xyz).r;
}


vec4 apply_colormap(float val) {
    val = (val - u_clim[0]) / (u_clim[1] - u_clim[0]);
    vec4 color = u_color*val;
    //color = color + vec4(val, val, val, 1.0);
    return color;
}

vec4 apply_colormap2(float val) {
    val = (val - u_clim2[0]) / (u_clim2[1] - u_clim2[0]);
    vec4 color = u_color2*val;
    //color = color + vec4(val, val, val, 1.0);
    return color;
}

vec4 apply_colormap3(float val) {
    val = (val - u_clim3[0]) / (u_clim3[1] - u_clim3[0]);
    vec4 color = u_color3*val;
    //color = color + vec4(val, val, val, 1.0);
    return color;
}

vec4 apply_colormap4(float val) {
        val = (val - u_clim4[0]) / (u_clim4[1] - u_clim4[0]);
        vec4 color = u_color4*val;
        //color = color + vec4(val, val, val, 1.0);
        return color;
}

vec4 apply_colormap5(float val) {
        val = (val - u_clim5[0]) / (u_clim5[1] - u_clim5[0]);
        vec4 color = u_color5*val;
        //color = color + vec4(val, val, val, 1.0);
        return color;
}

vec4 apply_colormap6(float val) {
        val = (val - u_clim6[0]) / (u_clim6[1] - u_clim6[0]);
        vec4 color = u_color6*val;
        //color = color + vec4(val, val, val, 1.0);
        return color;
}


void cast_iso(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {

    gl_FragColor = vec4(0.0);// init transparent
    vec4 color3 = vec4(0.0);// final color
    vec3 dstep = 1.5 / u_size;// step to sample derivative
    vec3 loc = start_loc;

    float low_threshold = u_renderthreshold - 0.02 * (u_clim[1] - u_clim[0]);

    // Enter the raycasting loop. In WebGL 1 the loop index cannot be compared with
    // non-constant expression. So we use a hard-coded max, and an additional condition
    // inside the loop.
    for (int iter=0; iter<MAX_STEPS; iter++) {
        if (iter >= nsteps)
        break;

        // Sample from the 3D texture
        float val = sample1(loc);

        // Take the last interval in smaller steps
        vec3 iloc = loc - 0.5 * step;
        vec3 istep = step / float(REFINEMENT_STEPS);
        for (int i=0; i<REFINEMENT_STEPS; i++) {
            val = sample1(iloc);
            if (val > u_renderthreshold) {
                gl_FragColor = add_lighting(val, iloc, dstep, view_ray);
                return;
            }
            iloc += istep;
        }


        // Advance location deeper into the volume
        loc += step;
    }
}

void cast_dvr(vec3 start_loc, vec3 step, int nsteps, vec3 view_ray) {

    gl_FragColor = vec4(0.0);// init transparent
    vec4 color3 = vec4(0.0);// final color
    vec3 dstep = 1.5 / u_size;// step to sample derivative
    vec3 loc = start_loc;

    float low_threshold = u_renderthreshold - 0.02 * (u_clim[1] - u_clim[0]);

    // Enter the raycasting loop. In WebGL 1 the loop index cannot be compared with
    // non-constant expression. So we use a hard-coded max, and an additional condition
    // inside the loop.
    float x = gl_FragCoord.x/u_window_size.x;
    float y = gl_FragCoord.y/u_window_size.y;

    for (int iter=0; iter<MAX_STEPS; iter++) {
        if (iter >= nsteps)
        break;

        vec4 val_color = vec4(0.0, 0, 0, 0);
        if (linearize_z(texture2D(u_geo_depth, vec2(x, y)).r) < gl_FragCoord.z) {
            vec4 val_color = texture2D(u_geo_color, vec2(x, y));
            //float sum = val_color.r + val_color.g + val_color.b;
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
            return;
        }

        // Sample from the 3D texture
        float val = sample1(loc);
        if (val > u_renderthreshold) {
            vec4 val_color = add_lighting(val, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        float val2 = sample2(loc);
        if (val2 > u_renderthreshold2) {
            vec4 val_color = add_lighting2(val2, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale2);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        float val3 = sample3(loc);
        if (val3 > u_renderthreshold3) {
            vec4 val_color = add_lighting3(val3, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale3);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        float val4 = sample4(loc);
        if (val4 > u_renderthreshold4) {
            vec4 val_color = add_lighting4(val4, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale4);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        float val5 = sample5(loc);
        if (val5 > u_renderthreshold5) {
            vec4 val_color = add_lighting5(val5, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale5);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        float val6 = sample6(loc);
        if (val6 > u_renderthreshold6) {
            vec4 val_color = add_lighting6(val6, loc, dstep, view_ray);
            val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale6);
            gl_FragColor.rgb += (1.0 - gl_FragColor.a) * val_color.a * val_color.rgb;
            gl_FragColor.a += (1.0 - gl_FragColor.a) * val_color.a;
        }

        if (gl_FragColor.a > 0.95) {
            return;
        }


        // Advance location deeper into the volume
        loc += step;
        gl_FragDepth = 1.0-loc.z;
    }
}


vec4 add_lighting(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample1(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample1(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample1(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample1(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample1(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample1(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}

vec4 add_lighting2(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample2(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample2(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample2(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample2(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample2(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample2(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap2(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}

vec4 add_lighting3(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample3(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample3(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample3(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample3(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample3(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample3(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap3(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}


vec4 add_lighting4(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample4(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample4(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample4(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample4(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample4(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample4(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap4(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}


vec4 add_lighting5(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample5(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample5(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample5(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample5(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample5(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample5(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap5(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}

vec4 add_lighting6(float val, vec3 loc, vec3 step, vec3 view_ray)
{
    // Calculate color by incorporating lighting

    // View direction
    vec3 V = normalize(view_ray);

    // calculate normal vector from gradient
    vec3 N;
    float val1, val2;
    val1 = sample6(loc + vec3(-step[0], 0.0, 0.0));
    val2 = sample6(loc + vec3(+step[0], 0.0, 0.0));
    N[0] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample6(loc + vec3(0.0, -step[1], 0.0));
    val2 = sample6(loc + vec3(0.0, +step[1], 0.0));
    N[1] = val1 - val2;
    val = max(max(val1, val2), val);
    val1 = sample6(loc + vec3(0.0, 0.0, -step[2]));
    val2 = sample6(loc + vec3(0.0, 0.0, +step[2]));
    N[2] = val1 - val2;
    val = max(max(val1, val2), val);

    float gm = length(N);// gradient magnitude
    N = normalize(N);

    // Flip normal so it points towards viewer
    float Nselect = float(dot(N, V) > 0.0);
    N = (2.0 * Nselect - 1.0) * N;// ==	Nselect * N - (1.0-Nselect)*N;

    // Init colors
    vec4 ambient_color = vec4(0.1, 0.1, 0.1, 0.1);
    vec4 diffuse_color = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 specular_color = vec4(0.0, 0.0, 0.0, 0.0);

    // note: could allow multiple lights
    for (int i=0; i<1; i++)
    {
        // Get light direction (make sure to prevent zero devision)
        vec3 L = normalize(view_ray);//lightDirs[i];
        float lightEnabled = float(length(L) > 0.0);
        L = normalize(L + (1.0 - lightEnabled));

        // Calculate lighting properties
        float lambertTerm = clamp(dot(N, L), 0.0, 1.0);
        vec3 H = normalize(L+V);// Halfway vector
        float specularTerm = pow(max(dot(H, N), 0.0), shininess);

        // Calculate mask
        float mask1 = lightEnabled;

        // Calculate colors
        ambient_color +=    mask1 * ambient_color;// * gl_LightSource[i].ambient;
        diffuse_color +=    mask1 * lambertTerm;
        specular_color += mask1 * specularTerm * specular_color;
    }

    // Calculate final color by componing different components
    vec4 final_color;
    vec4 color = apply_colormap6(val);
    //vec4 color = vec4(u_color.xyz,val);
    final_color = color * (ambient_color + diffuse_color) + specular_color;
    final_color.a = val;
    return final_color;
}


float linearize_z(float z) {
    return u_camera_near * u_camera_far / (u_camera_far + z * (u_camera_near - u_camera_far));
}
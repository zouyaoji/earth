/**
 * micro - a grab bag of somewhat useful utility functions and other stuff that requires unit testing
 *
 * Copyright (c) 2014 Cameron Beccario
 * The MIT License - http://opensource.org/licenses/MIT
 *
 * https://github.com/cambecc/earth
 */
var µ = function() {
    "use strict";

    var τ = 2 * Math.PI;
    var H = Math.pow(10, -5.2);
    var DEFAULT_CONFIG = "current/wind/isobaric/1000hPa/orthographic";
    var TOPOLOGY = isMobile() ? "/data/earth-topo-mobile.json" : "/data/earth-topo.json";

    /**
     * @returns {Boolean} true if the specified value is truthy.
     */
    function isTruthy(x) {
        return !!x;
    }

    /**
     * @returns {Boolean} true if the specified value is not null and not undefined.
     */
    function isValue(x) {
        return x !== null && x !== undefined;
    }

    /**
     * @returns {Object} the first argument if not null and not undefined, otherwise the second argument.
     */
    function coalesce(a, b) {
        return isValue(a) ? a : b;
    }

    /**
     * @returns {Number} returns remainder of floored division, i.e., floor(a / n). Useful for consistent modulo
     *          of negative numbers. See http://en.wikipedia.org/wiki/Modulo_operation.
     */
    function floorMod(a, n) {
        return a - n * Math.floor(a / n);
    }

    /**
     * @returns {Number} distance between two points having the form [x, y].
     */
    function distance(a, b) {
        var Δx = b[0] - a[0];
        var Δy = b[1] - a[1];
        return Math.sqrt(Δx * Δx + Δy * Δy);
    }

    /**
     * @returns {Number} the value x clamped to the range [low, high].
     */
    function clamp(x, range) {
        return Math.max(range[0], Math.min(x, range[1]));
    }

    /**
     * @returns {Boolean} true if agent is probably firefox. Don't really care if this is accurate.
     */
    function isFF() {
        return (/firefox/i).test(navigator.userAgent);
    }

    /**
     * @returns {Boolean} true if agent is probably a mobile device. Don't really care if this is accurate.
     */
    function isMobile() {
        return (/android|blackberry|iemobile|ipad|iphone|ipod|opera mini|webos/i).test(navigator.userAgent);
    }

    function toUTCISO(date) {
        return date.getUTCFullYear() + "-" +
            (date.getUTCMonth() + 101).toString().substr(1) + "-" +
            (date.getUTCDate() + 100).toString().substr(1) + " " +
            (date.getUTCHours() + 100).toString().substr(1) + ":00";
    }

    function toLocalISO(date) {
        return date.getFullYear() + "-" +
            (date.getMonth() + 101).toString().substr(1) + "-" +
            (date.getDate() + 100).toString().substr(1) + " " +
            (date.getHours() + 100).toString().substr(1) + ":00";
    }

    /**
     * @returns {Object} an object to perform logging, if/when the browser supports it.
     */
    function log() {
        function format(o) { return o && o.stack ? o + "\n" + o.stack : o; }
        return {
            debug:   function(s) { if (console && console.log) console.log(format(s)); },
            info:    function(s) { if (console && console.info) console.info(format(s)); },
            error:   function(e) { if (console && console.error) console.error(format(e)); },
            time:    function(s) { if (console && console.time) console.time(format(s)); },
            timeEnd: function(s) { if (console && console.timeEnd) console.timeEnd(format(s)); }
        };
    }

    /**
     * @returns {width: (Number), height: (Number)} an object that describes the size of the browser's current view.
     */
    function view() {
        var w = window;
        var d = document && document.documentElement;
        var b = document && document.getElementsByTagName("body")[0];
        var x = w.innerWidth || d.clientWidth || b.clientWidth;
        var y = w.innerHeight || d.clientHeight || b.clientHeight;
        return {width: x, height: y};
    }

    /**
     * Removes all children of the specified DOM element.
     */
    function removeChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    /**
     * @returns {Object} clears and returns the specified Canvas element's 2d context.
     */
    function clearCanvas(canvas) {
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        return canvas;
    }

    /**
     * Produces a color style in a rainbow-like trefoil color space. Not quite HSV, but produces a nice
     * spectrum. See http://krazydad.com/tutorials/makecolors.php.
     *
     * @param hue the hue rotation in the range [0, 1]
     * @param a the alpha value in the range [0, 1]
     * @returns {Array} [r, g, b, a]
     */
    function sinebowColorStyle(hue, a) {
        // Map hue [0, 1] to radians [0, 5/6τ]. Don't allow a full rotation because that keeps hue == 0 and
        // hue == 1 from mapping to the same color.
        var rad = hue * τ * 5/6;
        rad *= 0.75;  // increase frequency to 2/3 cycle per rad

        var s = Math.sin(rad);
        var c = Math.cos(rad);
        var r = Math.floor(Math.max(0, -c) * 255);
        var g = Math.floor(Math.max(s, 0) * 255);
        var b = Math.floor(Math.max(c, 0, -s) * 255);
        return [r, g, b, a];
    }

    function asColorStyle(r, g, b, a) {
        return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
    }

    /**
     * @returns {Array} of wind colors and a method, indexFor, that maps wind magnitude to an index on the color scale.
     */
    function windColorScale(step, maxWind) {
        var result = [];
        for (var j = 85; j <= 255; j += step) {
            result.push(asColorStyle(j, j, j, 1.0));
        }
        result.indexFor = function(m) {  // map wind speed to a style
            return Math.floor(Math.min(m, maxWind) / maxWind * (result.length - 1));
        };
        return result;
    }

    /**
     * Returns a human readable string for the provided coordinates.
     */
    function formatCoordinates(λ, φ) {
        return Math.abs(φ).toFixed(2) + "º " + (φ >= 0 ? "N" : "S") + ", " +
            Math.abs(λ).toFixed(2) + "º " + (λ >= 0 ? "E" : "W");
    }

    /**
     * Returns a human readable string for the provided rectangular wind vector.
     * See http://mst.nerc.ac.uk/wind_vect_convs.html.
     */
    function formatVector(wind) {
        var d = Math.atan2(-wind[0], -wind[1]) / τ * 360;  // calculate into-the-wind cardinal degrees
        var wd = Math.round((d + 360) % 360 / 5) * 5;  // shift [-180, 180] to [0, 360], and round to nearest 5.
        return wd.toFixed(0) + "º @ " + wind[2].toFixed(1) + " m/s";
    }

    /**
     * Returns a promise for a JSON resource (URL) fetched via XHR. If the load fails, the promise rejects with an
     * object describing the reason: {status: http-status-code, message: http-status-text, resource:}.
     */
    function loadJson(resource) {
        var d = when.defer();
        d3.json(resource, function(error, result) {
            return error ?
                !error.status ?
                    d.reject({status: -1, message: "Cannot load resource: " + resource, resource: resource}) :
                    d.reject({status: error.status, message: error.statusText, resource: resource}) :
                d.resolve(result);
        });
        return d.promise;
    }

    /**
     * Returns the distortion introduced by the specified projection at the given point.
     *
     * This method uses finite difference estimates to calculate warping by adding a very small amount (h) to
     * both the longitude and latitude to create two lines. These lines are then projected to pixel space, where
     * the slopes of the lines represent how much the projection warps longitude and latitude at that location.
     *
     * <pre>
     *        (λ, φ+h)                  (xλ, yλ)
     *           .                         .
     *           |               ==>        \
     *           |                           \   __. (xφ, yφ)
     *    (λ, φ) .____. (λ+h, φ)       (x, y) .--
     * </pre>
     *
     * See:
     *     gis.stackexchange.com/questions/5068/how-to-create-an-accurate-tissot-indicatrix
     *     www.jasondavies.com/maps/tissot
     *
     * @returns {Array} array of derivatives [dx/dλ, dy/dλ, dx/dφ, dy/dφ]
     */
    function distortion(projection, λ, φ, x, y) {
        var hλ = λ < 0 ? H : -H;
        var hφ = φ < 0 ? H : -H;
        var pλ = projection([λ + hλ, φ]);
        var pφ = projection([λ, φ + hφ]);
        return [
            (pλ[0] - x) / hλ,
            (pλ[1] - y) / hλ,
            (pφ[0] - x) / hφ,
            (pφ[1] - y) / hφ
        ];
    }

    /**
     * Returns a new agent. An agent executes tasks and stores the result of the most recently completed task.
     *
     * A task is a callback that yields a value or promise. After submitting a task to an agent using the submit()
     * method, the task is invoked and its result becomes the agent's value, replacing the previous value. If a
     * task is submitted to an agent while an earlier task is still in progress, the earlier task is cancelled and
     * its result ignored. Invocation of a task may even be skipped entirely if cancellation occurs early enough.
     *
     * Agents are Backbone.js Event emitters. When a submitted task is accepted for invocation by an agent, a
     * "submit" event is emitted. This event provides the agent as its sole argument. When a task finishes and
     * the agent's value changes, an "update" event is emitted, providing (value, agent) as arguments. If a task
     * fails by either throwing an exception or rejecting a promise, a "reject" event having arguments (err, agent)
     * is emitted.
     *
     * The current task can be cancelled by invoking the agent.cancel() method, and the cancel status is available
     * as the Boolean agent.cancel.requested key. Within the task callback, the "this" context is set to the agent,
     * so a task can know to abort execution by checking the this.cancel.requested key. Similarly, a task can cancel
     * itself by invoking this.cancel().
     *
     * Example pseudocode:
     * <pre>
     *     var agent = newAgent();
     *     agent.on("update", function(value) {
     *         console.log("task completed: " + value);  // same as agent.value()
     *     });
     *
     *     function someLongAsynchronousProcess(x) {  // x === 10
     *         var d = when.defer();
     *         // some long process that eventually calls: d.resolve(result)
     *         return d.promise;
     *     }
     *
     *     agent.submit(someLongAsynchronousProcess, 10);
     * </pre>
     *
     * @returns {Object}
     */
    function newAgent() {

        /**
         * @returns {Function} a cancel function for a task.
         */
        function cancelFactory() {
            return function cancel() {
                cancel.requested = true;
                return agent;
            }
        }

        /**
         * Invokes the specified task.
         * @param cancel the task's cancel function.
         * @param taskAndArguments the [task-callback, arg0, arg1, ...] array.
         */
        function runTask(cancel, taskAndArguments) {

            function run(args) {
                return cancel.requested ? null : task.apply(agent, args);
            }

            function accept(result) {
                if (!cancel.requested) {
                    value = result;
                    agent.trigger("update", result, agent);
                }
            }

            function reject(err) {
                if (!cancel.requested) {  // ANNOYANCE: when cancelled, this task's error is silently suppressed
                    value = null;
                    agent.trigger("reject", err, agent);
                }
            }

            // When all arguments are resolved, invoke the task then either accept or reject the result.
            var task = taskAndArguments[0];
            when.all(_.rest(taskAndArguments)).then(run).done(accept, reject);
            agent.trigger("submit", agent);
        }

        var value = null;
        var runTask_debounced = _.debounce(runTask, 0);  // ignore multiple simultaneous submissions--reduces noise
        var agent = {

            /**
             * @returns {Object} this agent's current value.
             */
            value: function() {
                return value;
            },

            /**
             * Cancels this agent's most recently submitted task.
             */
            cancel: cancelFactory(),

            /**
             * Submit a new task and arguments to invoke the task with. The task may return a promise for
             * asynchronous tasks, and all arguments may be either values or promises. The previously submitted
             * task, if any, is immediately cancelled.
             * @returns this agent.
             */
            submit: function(task, arg0, arg1, and_so_on) {
                // immediately cancel the previous task
                this.cancel();
                // schedule the new task and update the agent with its associated cancel function
                runTask_debounced(this.cancel = cancelFactory(), arguments);
                return this;
            }
        };

        return _.extend(agent, Backbone.Events);
    }

    /**
     * Parses a URL hash fragment:
     *
     * example: "2013/11/14/0900Z/wind/isobaric/1000hPa/orthographic=26.50,-153.00,1430/overlay=off"
     * output: {date: "2013/11/14", hour: "0900", param: "wind", surface: "isobaric", level: "1000hPa",
     *          projection: "orthographic", orientation: "26.50,-153.00,1430", overlay: "off"}
     *
     * grammar:
     *     hash   := ( "current" | yyyy / mm / dd / hhhh "Z" ) / param / surface / level [ / option [ / option ... ] ]
     *     option := type [ "=" number [ "," number [ ... ] ] ]
     *
     * @param hash the hash fragment.
     * @param projectionNames the set of allowed projections.
     * @returns {Object} the result of the parse.
     */
    function parse(hash, projectionNames) {
        var tokens, option, result = {};
        if ((tokens = /^(current|\d{4}\/\d{2}\/\d{2}\/(\d{4})Z)\/(\w+)\/(\w+)\/(\w+)([\/].+)?/.exec(hash))) {
            result = {
                date: tokens[1].substr(0, 10),    // "current" or "yyyy/mm/dd"
                hour: coalesce(tokens[2], ""),    // "hhhh" or ""
                param: tokens[3],                 // non-empty alphanumeric _
                surface: tokens[4],               // non-empty alphanumeric _
                level: tokens[5],                 // non-empty alphanumeric _
                projection: "orthographic",
                orientation: "",
                topology: TOPOLOGY,
                overlay: "wv"
            };
            coalesce(tokens[6], "").split("/").forEach(function(segment) {
                if ((option = /^(\w+)(=([\d\-.,]*))?$/.exec(segment))) {
                    if (projectionNames.has(option[1])) {
                        result.projection = option[1];                 // non-empty alphanumeric _
                        result.orientation = coalesce(option[3], "");  // comma delimited string of numbers, or ""
                    }
                }
                else if ((option = /^overlay=off$/.exec(segment))) {
                    result.overlay = "off";
                }
            });
        }
        return result;
    }

    /**
     * A Backbone.js Model that persists its attributes as a human readable URL hash fragment. Loading from and
     * storing to the hash fragment is handled by the sync method.
     */
    var Configuration = Backbone.Model.extend({
        id: 0,
        _ignoreNextHashChangeEvent: false,
        _projectionNames: null,

        /**
         * @returns {String} this configuration converted to a hash fragment.
         */
        toHash: function() {
            var attr = this.attributes;
            var dir = attr.date === "current" ? "current" : attr.date + "/" + attr.hour + "Z";
            var proj = [attr.projection, attr.orientation].filter(isTruthy).join("=");
            var ol = attr.overlay === "off" ? "overlay=off" : "";
            return [dir, attr.param, attr.surface, attr.level, proj, ol].filter(isTruthy).join("/");
        },

        /**
         * @returns {String} the path to the weather data JSON file implied by this configuration.
         */
        toPath: function() {
            var attr = this.attributes;
            var dir = attr.date;
            var stamp = dir === "current" ? "current" : attr.hour;
            var file = [stamp, attr.param, attr.surface, attr.level, "gfs", "1.0"].join("-") + ".json";
            return ["/data/weather", dir, file].join("/");
        },

        /**
         * Synchronizes between the configuration model and the hash fragment in the URL bar. Invocations
         * caused by "hashchange" events must have the {trigger: "hashchange"} option specified.
         */
        sync: function(method, model, options) {
            switch (method) {
                case "read":
                    if (options.trigger === "hashchange" && model._ignoreNextHashChangeEvent) {
                        model._ignoreNextHashChangeEvent = false;
                        return;
                    }
                    model.set(parse(window.location.hash.substr(1) || DEFAULT_CONFIG, model._projectionNames));
                    break;
                case "update":
                    // Ugh. Setting the hash fires a hashchange event during the next event loop turn. Ignore it.
                    model._ignoreNextHashChangeEvent = true;
                    window.location.hash = model.toHash();
                    break;
            }
        }
    });

    /**
     * A Backbone.js Model to hold the page's configuration as a set of attributes: date, layer, projection,
     * orientation, etc. Changes to the configuration fire events which the page's components react to. For
     * example, configuration.save({projection: "orthographic"}) fires an event which causes the globe to be
     * re-rendered with an orthographic projection.
     *
     * All configuration attributes are persisted in a human readable form to the page's hash fragment (and
     * vice versa). This allows deep linking and back-button navigation.
     *
     * @returns {Configuration} Model to represent the hash fragment, using the specified set of allowed projections.
     */
    function buildConfiguration(projectionNames) {
        var result = new Configuration();
        result._projectionNames = projectionNames;
        return result;
    }

    return {
        isTruthy: isTruthy,
        isValue: isValue,
        coalesce: coalesce,
        floorMod: floorMod,
        distance: distance,
        clamp: clamp,
        isFF: isFF,
        isMobile: isMobile,
        toUTCISO: toUTCISO,
        toLocalISO: toLocalISO,
        log: log,
        view: view,
        removeChildren: removeChildren,
        clearCanvas: clearCanvas,
        sinebowColorStyle: sinebowColorStyle,
        windColorScale: windColorScale,
        formatCoordinates: formatCoordinates,
        formatVector: formatVector,
        loadJson: loadJson,
        distortion: distortion,
        newAgent: newAgent,
        parse: parse,
        buildConfiguration: buildConfiguration
    };

}();
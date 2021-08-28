
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root.host) {
            return root;
        }
        return document;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = append_empty_stylesheet(node).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.42.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src/Bar.svelte generated by Svelte v3.42.3 */

    const file$4 = "src/Bar.svelte";

    function create_fragment$4(ctx) {
    	let div1;
    	let div0;
    	let div0_class_value;
    	let div0_style_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");

    			attr_dev(div0, "class", div0_class_value = `${/*width*/ ctx[0] === 1
			? /*error*/ ctx[1] ? "bg-bad" : "bg-good"
			: "bg-s"} w-0 h-full rounded-sm smooth`);

    			attr_dev(div0, "style", div0_style_value = `width: ${100 * /*width*/ ctx[0]}%`);
    			add_location(div0, file$4, 5, 2, 166);
    			attr_dev(div1, "class", "bg-light-s w-11/12 sm:w-5/6 md:w-1/2 h-4 mx-auto mt-6 rounded-sm");
    			add_location(div1, file$4, 4, 0, 85);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*width, error*/ 3 && div0_class_value !== (div0_class_value = `${/*width*/ ctx[0] === 1
			? /*error*/ ctx[1] ? "bg-bad" : "bg-good"
			: "bg-s"} w-0 h-full rounded-sm smooth`)) {
    				attr_dev(div0, "class", div0_class_value);
    			}

    			if (dirty & /*width*/ 1 && div0_style_value !== (div0_style_value = `width: ${100 * /*width*/ ctx[0]}%`)) {
    				attr_dev(div0, "style", div0_style_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bar', slots, []);
    	let { width = 0 } = $$props;
    	let { error = false } = $$props;
    	const writable_props = ['width', 'error'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('error' in $$props) $$invalidate(1, error = $$props.error);
    	};

    	$$self.$capture_state = () => ({ width, error });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('error' in $$props) $$invalidate(1, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, error];
    }

    class Bar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { width: 0, error: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bar",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get width() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get error() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set error(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* eslint-disable ts-exports/unused-exports */
    const clump = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };
    const api = async (endPoint, token) => {
        const url = `https://api.spotify.com/v1/${endPoint}`;
        const response = await fetch(url, {
            headers: { Authorization: "Bearer " + token },
        });
        return (await response.json());
    };
    const apiBody = async (endPoint, token, body, method) => {
        const url = `https://api.spotify.com/v1/${endPoint}`;
        const response = await fetch(url, {
            method: method !== null && method !== void 0 ? method : "POST",
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        return await response.json();
    };

    /* src/Add.svelte generated by Svelte v3.42.3 */

    const { console: console_1$1 } = globals;
    const file$3 = "src/Add.svelte";

    // (56:0) {#if error}
    function create_if_block$1(ctx) {
    	let p;
    	let t;
    	let p_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*error*/ ctx[3]);
    			attr_dev(p, "class", "text-bad");
    			add_location(p, file$3, 56, 2, 2203);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*error*/ 8) set_data_dev(t, /*error*/ ctx[3]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fade, { duration: 200 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fade, { duration: 200 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_transition) p_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(56:0) {#if error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let h2;
    	let t1;
    	let bar;
    	let t2;
    	let input;
    	let t3;
    	let br;
    	let t4;
    	let button;
    	let t5;
    	let button_disabled_value;
    	let t6;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;

    	bar = new Bar({
    			props: {
    				width: /*progress*/ ctx[2],
    				error: !!/*error*/ ctx[3]
    			},
    			$$inline: true
    		});

    	let if_block = /*error*/ ctx[3] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "3. Add";
    			t1 = space();
    			create_component(bar.$$.fragment);
    			t2 = space();
    			input = element("input");
    			t3 = space();
    			br = element("br");
    			t4 = space();
    			button = element("button");
    			t5 = text("Add");
    			t6 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			add_location(h2, file$3, 46, 0, 1938);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", "Playlist name");
    			add_location(input, file$3, 48, 0, 1995);
    			add_location(br, file$3, 49, 0, 2071);
    			attr_dev(button, "class", "btn");
    			button.disabled = button_disabled_value = /*step*/ ctx[0] < 2 || 0 < /*progress*/ ctx[2] && /*progress*/ ctx[2] < 1;
    			add_location(button, file$3, 50, 0, 2078);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			mount_component(bar, target, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*playlistName*/ ctx[1]);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, t5);
    			insert_dev(target, t6, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[7]),
    					listen_dev(button, "click", /*click*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const bar_changes = {};
    			if (dirty & /*progress*/ 4) bar_changes.width = /*progress*/ ctx[2];
    			if (dirty & /*error*/ 8) bar_changes.error = !!/*error*/ ctx[3];
    			bar.$set(bar_changes);

    			if (dirty & /*playlistName*/ 2 && input.value !== /*playlistName*/ ctx[1]) {
    				set_input_value(input, /*playlistName*/ ctx[1]);
    			}

    			if (!current || dirty & /*step, progress*/ 5 && button_disabled_value !== (button_disabled_value = /*step*/ ctx[0] < 2 || 0 < /*progress*/ ctx[2] && /*progress*/ ctx[2] < 1)) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (/*error*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*error*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			destroy_component(bar, detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t6);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Add', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let { step = 0 } = $$props;
    	let { token = "" } = $$props;
    	let { tracksText = "" } = $$props;
    	let playlistName = "";
    	let progress = 0;
    	let error = "";

    	const click = () => {
    		$$invalidate(2, progress = 0.01);

    		const run = () => __awaiter(void 0, void 0, void 0, function* () {
    			const playlists = yield api("me/playlists", token);
    			const matchingPlaylists = playlists.items.filter(p => p.name === playlistName);

    			if (!matchingPlaylists.length) {
    				throw `Couldn't find "${playlistName}"`;
    			}

    			const playlistId = matchingPlaylists[0].id;
    			const clumps = clump(tracksText.split("\n").filter(id => id.trim().length), 100);

    			for (const i in clumps) {
    				const ids = clumps[i];

    				yield apiBody(`playlists/${playlistId}/tracks`, token, {
    					uris: ids.map(id => `spotify:track:${id.trim()}`)
    				});

    				$$invalidate(2, progress = (parseInt(i) + 1) / clumps.length);
    			}

    			$$invalidate(2, progress = 1);
    			$$invalidate(0, step = Math.max(step, 3));
    		});

    		run().catch(err => {
    			$$invalidate(3, error = err);
    			$$invalidate(2, progress = 1);
    			console.error(err);
    		});
    	};

    	const writable_props = ['step', 'token', 'tracksText'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Add> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		playlistName = this.value;
    		$$invalidate(1, playlistName);
    	}

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('token' in $$props) $$invalidate(5, token = $$props.token);
    		if ('tracksText' in $$props) $$invalidate(6, tracksText = $$props.tracksText);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		fade,
    		Bar,
    		api,
    		apiBody,
    		clump,
    		step,
    		token,
    		tracksText,
    		playlistName,
    		progress,
    		error,
    		click
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('token' in $$props) $$invalidate(5, token = $$props.token);
    		if ('tracksText' in $$props) $$invalidate(6, tracksText = $$props.tracksText);
    		if ('playlistName' in $$props) $$invalidate(1, playlistName = $$props.playlistName);
    		if ('progress' in $$props) $$invalidate(2, progress = $$props.progress);
    		if ('error' in $$props) $$invalidate(3, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		step,
    		playlistName,
    		progress,
    		error,
    		click,
    		token,
    		tracksText,
    		input_input_handler
    	];
    }

    class Add extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { step: 0, token: 5, tracksText: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Add",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get step() {
    		throw new Error("<Add>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set step(value) {
    		throw new Error("<Add>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get token() {
    		throw new Error("<Add>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set token(value) {
    		throw new Error("<Add>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tracksText() {
    		throw new Error("<Add>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tracksText(value) {
    		throw new Error("<Add>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Auth.svelte generated by Svelte v3.42.3 */
    const file$2 = "src/Auth.svelte";

    function create_fragment$2(ctx) {
    	let h2;
    	let t1;
    	let p;
    	let t3;
    	let bar;
    	let t4;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	bar = new Bar({
    			props: { width: /*authed*/ ctx[0] ? 1 : 0 },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "1. Authentication";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Automatically log in to your Spotify account";
    			t3 = space();
    			create_component(bar.$$.fragment);
    			t4 = space();
    			button = element("button");
    			button.textContent = "Authenticate";
    			add_location(h2, file$2, 21, 0, 558);
    			add_location(p, file$2, 22, 0, 585);
    			attr_dev(button, "class", "btn");
    			add_location(button, file$2, 24, 0, 668);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(bar, target, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, button, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click*/ ctx[1], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const bar_changes = {};
    			if (dirty & /*authed*/ 1) bar_changes.width = /*authed*/ ctx[0] ? 1 : 0;
    			bar.$set(bar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			destroy_component(bar, detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Auth', slots, []);
    	let { authed = false } = $$props;
    	let { home = "" } = $$props;

    	const click = () => {
    		const clientId = "5dfa309106f847819f19d5af2dd774cb";
    		const redirectUri = home;

    		const authUrl = "https://accounts.spotify.com/authorize?" + [
    			`client_id=${clientId}`,
    			"response_type=token",
    			`redirect_uri=${encodeURI(redirectUri)}`,
    			"scope=playlist-read-private playlist-modify-public playlist-modify-private"
    		].join("&");

    		window.location.href = authUrl;
    	};

    	const writable_props = ['authed', 'home'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Auth> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('authed' in $$props) $$invalidate(0, authed = $$props.authed);
    		if ('home' in $$props) $$invalidate(2, home = $$props.home);
    	};

    	$$self.$capture_state = () => ({ Bar, authed, home, click });

    	$$self.$inject_state = $$props => {
    		if ('authed' in $$props) $$invalidate(0, authed = $$props.authed);
    		if ('home' in $$props) $$invalidate(2, home = $$props.home);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [authed, click, home];
    }

    class Auth extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { authed: 0, home: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Auth",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get authed() {
    		throw new Error("<Auth>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set authed(value) {
    		throw new Error("<Auth>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get home() {
    		throw new Error("<Auth>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set home(value) {
    		throw new Error("<Auth>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Tracks.svelte generated by Svelte v3.42.3 */

    const { console: console_1 } = globals;
    const file$1 = "src/Tracks.svelte";

    // (67:0) {#if error}
    function create_if_block(ctx) {
    	let p;
    	let t;
    	let p_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*error*/ ctx[4]);
    			attr_dev(p, "class", "text-bad");
    			add_location(p, file$1, 67, 2, 2529);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty & /*error*/ 16) set_data_dev(t, /*error*/ ctx[4]);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fade, { duration: 200 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fade, { duration: 200 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching && p_transition) p_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(67:0) {#if error}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let h2;
    	let t1;
    	let p;
    	let t3;
    	let bar;
    	let t4;
    	let div2;
    	let div0;
    	let textarea0;
    	let t5;
    	let div1;
    	let textarea1;
    	let t6;
    	let button;
    	let t7;
    	let button_disabled_value;
    	let t8;
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;

    	bar = new Bar({
    			props: {
    				width: /*progress*/ ctx[3],
    				error: !!/*error*/ ctx[4]
    			},
    			$$inline: true
    		});

    	let if_block = /*error*/ ctx[4] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "2. Tracks";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Find your tracks on Spotify";
    			t3 = space();
    			create_component(bar.$$.fragment);
    			t4 = space();
    			div2 = element("div");
    			div0 = element("div");
    			textarea0 = element("textarea");
    			t5 = space();
    			div1 = element("div");
    			textarea1 = element("textarea");
    			t6 = space();
    			button = element("button");
    			t7 = text("Find tracks");
    			t8 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			add_location(h2, file$1, 50, 0, 2093);
    			add_location(p, file$1, 51, 0, 2112);
    			attr_dev(textarea0, "rows", "10");
    			add_location(textarea0, file$1, 55, 4, 2249);
    			attr_dev(div0, "class", "flex-1");
    			add_location(div0, file$1, 54, 2, 2224);
    			attr_dev(textarea1, "rows", "10");
    			add_location(textarea1, file$1, 58, 4, 2333);
    			attr_dev(div1, "class", "flex-1");
    			add_location(div1, file$1, 57, 2, 2308);
    			attr_dev(div2, "class", "flex justify-evenly");
    			add_location(div2, file$1, 53, 0, 2188);
    			attr_dev(button, "class", "btn");
    			button.disabled = button_disabled_value = /*step*/ ctx[0] < 1 || 0 < /*progress*/ ctx[3] && /*progress*/ ctx[3] < 1;
    			add_location(button, file$1, 61, 0, 2396);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			insert_dev(target, t3, anchor);
    			mount_component(bar, target, anchor);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, textarea0);
    			set_input_value(textarea0, /*queriesText*/ ctx[2]);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, textarea1);
    			set_input_value(textarea1, /*tracksText*/ ctx[1]);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, t7);
    			insert_dev(target, t8, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[7]),
    					listen_dev(textarea1, "input", /*textarea1_input_handler*/ ctx[8]),
    					listen_dev(button, "click", /*click*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const bar_changes = {};
    			if (dirty & /*progress*/ 8) bar_changes.width = /*progress*/ ctx[3];
    			if (dirty & /*error*/ 16) bar_changes.error = !!/*error*/ ctx[4];
    			bar.$set(bar_changes);

    			if (dirty & /*queriesText*/ 4) {
    				set_input_value(textarea0, /*queriesText*/ ctx[2]);
    			}

    			if (dirty & /*tracksText*/ 2) {
    				set_input_value(textarea1, /*tracksText*/ ctx[1]);
    			}

    			if (!current || dirty & /*step, progress*/ 9 && button_disabled_value !== (button_disabled_value = /*step*/ ctx[0] < 1 || 0 < /*progress*/ ctx[3] && /*progress*/ ctx[3] < 1)) {
    				prop_dev(button, "disabled", button_disabled_value);
    			}

    			if (/*error*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*error*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bar.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bar.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			destroy_component(bar, detaching);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t8);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tracks', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let { step = 0 } = $$props;
    	let { token = "" } = $$props;
    	let { tracksText = "" } = $$props;
    	let queriesText = ["Rick Astley Never Gonna Give You Up", "..."].join("\n");
    	let progress = 0;
    	let error = "";

    	const click = () => {
    		$$invalidate(3, progress = 0.01);
    		$$invalidate(4, error = "");

    		const run = () => __awaiter(void 0, void 0, void 0, function* () {
    			const clumpedQueries = clump(queriesText.split("\n").filter(q => q.trim().length), 100);
    			$$invalidate(1, tracksText = "");

    			for (const i in clumpedQueries) {
    				const queriesClump = clumpedQueries[i];
    				const tracks = yield Promise.all(queriesClump.map(q => api(encodeURI(`search?q=${q}&type=track`), token)));

    				const trackIds = tracks.map((t, i) => {
    					const { items } = t.tracks;
    					if (items.length) return items[0].id;
    					$$invalidate(4, error = `Couldn't find "${queriesClump[i]}"`);
    					return "";
    				});

    				$$invalidate(1, tracksText += trackIds.join("\n") + "\n");
    				$$invalidate(3, progress = (parseInt(i) + 1) / clumpedQueries.length);
    			}

    			$$invalidate(3, progress = 1);

    			if (!error) {
    				$$invalidate(0, step = Math.max(step, 2));
    			}
    		});

    		run().catch(err => {
    			$$invalidate(4, error = err);
    			$$invalidate(3, progress = 1);
    			console.error(err);
    		});
    	};

    	const writable_props = ['step', 'token', 'tracksText'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Tracks> was created with unknown prop '${key}'`);
    	});

    	function textarea0_input_handler() {
    		queriesText = this.value;
    		$$invalidate(2, queriesText);
    	}

    	function textarea1_input_handler() {
    		tracksText = this.value;
    		$$invalidate(1, tracksText);
    	}

    	$$self.$$set = $$props => {
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('token' in $$props) $$invalidate(6, token = $$props.token);
    		if ('tracksText' in $$props) $$invalidate(1, tracksText = $$props.tracksText);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		fade,
    		Bar,
    		api,
    		clump,
    		step,
    		token,
    		tracksText,
    		queriesText,
    		progress,
    		error,
    		click
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('step' in $$props) $$invalidate(0, step = $$props.step);
    		if ('token' in $$props) $$invalidate(6, token = $$props.token);
    		if ('tracksText' in $$props) $$invalidate(1, tracksText = $$props.tracksText);
    		if ('queriesText' in $$props) $$invalidate(2, queriesText = $$props.queriesText);
    		if ('progress' in $$props) $$invalidate(3, progress = $$props.progress);
    		if ('error' in $$props) $$invalidate(4, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		step,
    		tracksText,
    		queriesText,
    		progress,
    		error,
    		click,
    		token,
    		textarea0_input_handler,
    		textarea1_input_handler
    	];
    }

    class Tracks extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { step: 0, token: 6, tracksText: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tracks",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get step() {
    		throw new Error("<Tracks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set step(value) {
    		throw new Error("<Tracks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get token() {
    		throw new Error("<Tracks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set token(value) {
    		throw new Error("<Tracks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get tracksText() {
    		throw new Error("<Tracks>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set tracksText(value) {
    		throw new Error("<Tracks>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.42.3 */
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let a;
    	let t0;
    	let t1;
    	let ol;
    	let li0;
    	let auth;
    	let t2;
    	let li1;
    	let tracks;
    	let updating_step;
    	let updating_tracksText;
    	let t3;
    	let li2;
    	let add;
    	let updating_step_1;
    	let current;

    	auth = new Auth({
    			props: { authed: /*authed*/ ctx[0], home },
    			$$inline: true
    		});

    	function tracks_step_binding(value) {
    		/*tracks_step_binding*/ ctx[4](value);
    	}

    	function tracks_tracksText_binding(value) {
    		/*tracks_tracksText_binding*/ ctx[5](value);
    	}

    	let tracks_props = { token: /*token*/ ctx[2] };

    	if (/*step*/ ctx[1] !== void 0) {
    		tracks_props.step = /*step*/ ctx[1];
    	}

    	if (/*tracksText*/ ctx[3] !== void 0) {
    		tracks_props.tracksText = /*tracksText*/ ctx[3];
    	}

    	tracks = new Tracks({ props: tracks_props, $$inline: true });
    	binding_callbacks.push(() => bind(tracks, 'step', tracks_step_binding));
    	binding_callbacks.push(() => bind(tracks, 'tracksText', tracks_tracksText_binding));

    	function add_step_binding(value) {
    		/*add_step_binding*/ ctx[6](value);
    	}

    	let add_props = {
    		token: /*token*/ ctx[2],
    		tracksText: /*tracksText*/ ctx[3]
    	};

    	if (/*step*/ ctx[1] !== void 0) {
    		add_props.step = /*step*/ ctx[1];
    	}

    	add = new Add({ props: add_props, $$inline: true });
    	binding_callbacks.push(() => bind(add, 'step', add_step_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			a = element("a");
    			t0 = text("Playlist generator");
    			t1 = space();
    			ol = element("ol");
    			li0 = element("li");
    			create_component(auth.$$.fragment);
    			t2 = space();
    			li1 = element("li");
    			create_component(tracks.$$.fragment);
    			t3 = space();
    			li2 = element("li");
    			create_component(add.$$.fragment);
    			attr_dev(a, "href", home);
    			add_location(a, file, 39, 6, 1640);
    			add_location(h1, file, 39, 2, 1636);
    			add_location(li0, file, 41, 4, 1694);
    			add_location(li1, file, 44, 4, 1744);
    			add_location(li2, file, 47, 4, 1814);
    			add_location(ol, file, 40, 2, 1685);
    			attr_dev(main, "class", "text-center w-full");
    			add_location(main, file, 38, 0, 1600);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, a);
    			append_dev(a, t0);
    			append_dev(main, t1);
    			append_dev(main, ol);
    			append_dev(ol, li0);
    			mount_component(auth, li0, null);
    			append_dev(ol, t2);
    			append_dev(ol, li1);
    			mount_component(tracks, li1, null);
    			append_dev(ol, t3);
    			append_dev(ol, li2);
    			mount_component(add, li2, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const auth_changes = {};
    			if (dirty & /*authed*/ 1) auth_changes.authed = /*authed*/ ctx[0];
    			auth.$set(auth_changes);
    			const tracks_changes = {};
    			if (dirty & /*token*/ 4) tracks_changes.token = /*token*/ ctx[2];

    			if (!updating_step && dirty & /*step*/ 2) {
    				updating_step = true;
    				tracks_changes.step = /*step*/ ctx[1];
    				add_flush_callback(() => updating_step = false);
    			}

    			if (!updating_tracksText && dirty & /*tracksText*/ 8) {
    				updating_tracksText = true;
    				tracks_changes.tracksText = /*tracksText*/ ctx[3];
    				add_flush_callback(() => updating_tracksText = false);
    			}

    			tracks.$set(tracks_changes);
    			const add_changes = {};
    			if (dirty & /*token*/ 4) add_changes.token = /*token*/ ctx[2];
    			if (dirty & /*tracksText*/ 8) add_changes.tracksText = /*tracksText*/ ctx[3];

    			if (!updating_step_1 && dirty & /*step*/ 2) {
    				updating_step_1 = true;
    				add_changes.step = /*step*/ ctx[1];
    				add_flush_callback(() => updating_step_1 = false);
    			}

    			add.$set(add_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(auth.$$.fragment, local);
    			transition_in(tracks.$$.fragment, local);
    			transition_in(add.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(auth.$$.fragment, local);
    			transition_out(tracks.$$.fragment, local);
    			transition_out(add.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(auth);
    			destroy_component(tracks);
    			destroy_component(add);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const home = "http://localhost:5500/public/index.html";

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
    		function adopt(value) {
    			return value instanceof P
    			? value
    			: new P(function (resolve) {
    						resolve(value);
    					});
    		}

    		return new (P || (P = Promise))(function (resolve, reject) {
    				function fulfilled(value) {
    					try {
    						step(generator.next(value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function rejected(value) {
    					try {
    						step(generator["throw"](value));
    					} catch(e) {
    						reject(e);
    					}
    				}

    				function step(result) {
    					result.done
    					? resolve(result.value)
    					: adopt(result.value).then(fulfilled, rejected);
    				}

    				step((generator = generator.apply(thisArg, _arguments || [])).next());
    			});
    	};

    	let authed = false;
    	let step = 0;
    	let token = "";
    	let tracksText = "";
    	const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

    	const paramsToObj = params => {
    		const result = {};

    		params.forEach((value, key) => {
    			result[key] = value;
    		});

    		return result;
    	};

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		if (window.location.href.includes("#")) {
    			yield delay(1);
    			$$invalidate(0, authed = true);
    			$$invalidate(1, step = Math.max(step, 1));
    			const authResult = window.location.href.replace(/.*#/, "");
    			$$invalidate(2, token = paramsToObj(new URLSearchParams(authResult)).access_token);
    		}
    	}));

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function tracks_step_binding(value) {
    		step = value;
    		$$invalidate(1, step);
    	}

    	function tracks_tracksText_binding(value) {
    		tracksText = value;
    		$$invalidate(3, tracksText);
    	}

    	function add_step_binding(value) {
    		step = value;
    		$$invalidate(1, step);
    	}

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onMount,
    		writable,
    		Add,
    		Auth,
    		Tracks,
    		home,
    		authed,
    		step,
    		token,
    		tracksText,
    		delay,
    		paramsToObj
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('authed' in $$props) $$invalidate(0, authed = $$props.authed);
    		if ('step' in $$props) $$invalidate(1, step = $$props.step);
    		if ('token' in $$props) $$invalidate(2, token = $$props.token);
    		if ('tracksText' in $$props) $$invalidate(3, tracksText = $$props.tracksText);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		authed,
    		step,
    		token,
    		tracksText,
    		tracks_step_binding,
    		tracks_tracksText_binding,
    		add_step_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

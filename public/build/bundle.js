
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
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
    function append(target, node) {
        target.appendChild(node);
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
    const outroing = new Set();
    let outros;
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

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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

    /* src/Bar.svelte generated by Svelte v3.42.3 */

    const file$1 = "src/Bar.svelte";

    function create_fragment$1(ctx) {
    	let div1;
    	let div0;
    	let div0_class_value;
    	let div0_style_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", div0_class_value = `${/*width*/ ctx[0] === 1 ? "bg-good" : "bg-s"} w-0 h-full rounded-sm transition-all duration-700`);
    			attr_dev(div0, "style", div0_style_value = `width: ${100 * /*width*/ ctx[0]}%`);
    			add_location(div0, file$1, 4, 2, 134);
    			attr_dev(div1, "class", "bg-w w-11/12 sm:w-5/6 md:w-1/2 h-4 mx-auto mt-6 rounded-sm");
    			add_location(div1, file$1, 3, 0, 59);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*width*/ 1 && div0_class_value !== (div0_class_value = `${/*width*/ ctx[0] === 1 ? "bg-good" : "bg-s"} w-0 h-full rounded-sm transition-all duration-700`)) {
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Bar', slots, []);
    	let { width = 0 } = $$props;
    	const writable_props = ['width'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Bar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    	};

    	$$self.$capture_state = () => ({ width });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width];
    }

    class Bar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { width: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bar",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get width() {
    		throw new Error("<Bar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Bar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.42.3 */

    const { Error: Error_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let ul;
    	let li0;
    	let h20;
    	let t3;
    	let bar0;
    	let t4;
    	let input0;
    	let t5;
    	let br0;
    	let t6;
    	let button0;
    	let t8;
    	let li1;
    	let h21;
    	let t10;
    	let bar1;
    	let t11;
    	let div2;
    	let div0;
    	let textarea0;
    	let t12;
    	let div1;
    	let textarea1;
    	let t13;
    	let button1;
    	let t14;
    	let button1_disabled_value;
    	let t15;
    	let li2;
    	let h22;
    	let t17;
    	let bar2;
    	let t18;
    	let input1;
    	let t19;
    	let br1;
    	let t20;
    	let button2;
    	let t21;
    	let button2_disabled_value;
    	let current;
    	let mounted;
    	let dispose;

    	bar0 = new Bar({
    			props: { width: /*authed*/ ctx[1] ? 1 : 0 },
    			$$inline: true
    		});

    	bar1 = new Bar({
    			props: { width: /*tracksProgress*/ ctx[4] },
    			$$inline: true
    		});

    	bar2 = new Bar({
    			props: { width: /*addProgress*/ ctx[6] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "Playlist generator";
    			t1 = space();
    			ul = element("ul");
    			li0 = element("li");
    			h20 = element("h2");
    			h20.textContent = "Authentication";
    			t3 = space();
    			create_component(bar0.$$.fragment);
    			t4 = space();
    			input0 = element("input");
    			t5 = space();
    			br0 = element("br");
    			t6 = space();
    			button0 = element("button");
    			button0.textContent = "Auth";
    			t8 = space();
    			li1 = element("li");
    			h21 = element("h2");
    			h21.textContent = "Tracks";
    			t10 = space();
    			create_component(bar1.$$.fragment);
    			t11 = space();
    			div2 = element("div");
    			div0 = element("div");
    			textarea0 = element("textarea");
    			t12 = space();
    			div1 = element("div");
    			textarea1 = element("textarea");
    			t13 = space();
    			button1 = element("button");
    			t14 = text("Tracks");
    			t15 = space();
    			li2 = element("li");
    			h22 = element("h2");
    			h22.textContent = "Add";
    			t17 = space();
    			create_component(bar2.$$.fragment);
    			t18 = space();
    			input1 = element("input");
    			t19 = space();
    			br1 = element("br");
    			t20 = space();
    			button2 = element("button");
    			t21 = text("Add");
    			add_location(h1, file, 119, 2, 4874);
    			add_location(h20, file, 122, 6, 4924);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Client ID");
    			add_location(input0, file, 124, 6, 4991);
    			add_location(br0, file, 125, 6, 5065);
    			attr_dev(button0, "class", "btn");
    			add_location(button0, file, 126, 6, 5078);
    			add_location(li0, file, 121, 4, 4913);
    			add_location(h21, file, 129, 6, 5158);
    			attr_dev(textarea0, "rows", "10");
    			add_location(textarea0, file, 133, 10, 5290);
    			attr_dev(div0, "class", "flex-1");
    			add_location(div0, file, 132, 8, 5259);
    			attr_dev(textarea1, "rows", "10");
    			add_location(textarea1, file, 136, 10, 5392);
    			attr_dev(div1, "class", "flex-1");
    			add_location(div1, file, 135, 8, 5361);
    			attr_dev(div2, "class", "flex justify-evenly");
    			add_location(div2, file, 131, 6, 5217);
    			attr_dev(button1, "class", "btn");
    			button1.disabled = button1_disabled_value = !/*authed*/ ctx[1] || 0 < /*tracksProgress*/ ctx[4] && /*tracksProgress*/ ctx[4] < 1;
    			add_location(button1, file, 139, 6, 5473);
    			add_location(li1, file, 128, 4, 5147);
    			add_location(h22, file, 147, 6, 5662);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "Playlist name");
    			add_location(input1, file, 149, 6, 5715);
    			add_location(br1, file, 154, 6, 5827);
    			attr_dev(button2, "class", "btn");
    			button2.disabled = button2_disabled_value = !/*authed*/ ctx[1] || 0 < /*addProgress*/ ctx[6] && /*addProgress*/ ctx[6] < 1;
    			add_location(button2, file, 155, 6, 5840);
    			add_location(li2, file, 146, 4, 5651);
    			add_location(ul, file, 120, 2, 4904);
    			attr_dev(main, "class", "text-center w-full");
    			add_location(main, file, 118, 0, 4838);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, ul);
    			append_dev(ul, li0);
    			append_dev(li0, h20);
    			append_dev(li0, t3);
    			mount_component(bar0, li0, null);
    			append_dev(li0, t4);
    			append_dev(li0, input0);
    			set_input_value(input0, /*clientId*/ ctx[0]);
    			append_dev(li0, t5);
    			append_dev(li0, br0);
    			append_dev(li0, t6);
    			append_dev(li0, button0);
    			append_dev(ul, t8);
    			append_dev(ul, li1);
    			append_dev(li1, h21);
    			append_dev(li1, t10);
    			mount_component(bar1, li1, null);
    			append_dev(li1, t11);
    			append_dev(li1, div2);
    			append_dev(div2, div0);
    			append_dev(div0, textarea0);
    			set_input_value(textarea0, /*queriesText*/ ctx[2]);
    			append_dev(div2, t12);
    			append_dev(div2, div1);
    			append_dev(div1, textarea1);
    			set_input_value(textarea1, /*tracksText*/ ctx[3]);
    			append_dev(li1, t13);
    			append_dev(li1, button1);
    			append_dev(button1, t14);
    			append_dev(ul, t15);
    			append_dev(ul, li2);
    			append_dev(li2, h22);
    			append_dev(li2, t17);
    			mount_component(bar2, li2, null);
    			append_dev(li2, t18);
    			append_dev(li2, input1);
    			set_input_value(input1, /*playlistName*/ ctx[5]);
    			append_dev(li2, t19);
    			append_dev(li2, br1);
    			append_dev(li2, t20);
    			append_dev(li2, button2);
    			append_dev(button2, t21);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[10]),
    					listen_dev(button0, "click", /*authClick*/ ctx[7], false, false, false),
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[11]),
    					listen_dev(textarea1, "input", /*textarea1_input_handler*/ ctx[12]),
    					listen_dev(button1, "click", /*tracksClick*/ ctx[8], false, false, false),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[13]),
    					listen_dev(button2, "click", /*addClick*/ ctx[9], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const bar0_changes = {};
    			if (dirty & /*authed*/ 2) bar0_changes.width = /*authed*/ ctx[1] ? 1 : 0;
    			bar0.$set(bar0_changes);

    			if (dirty & /*clientId*/ 1 && input0.value !== /*clientId*/ ctx[0]) {
    				set_input_value(input0, /*clientId*/ ctx[0]);
    			}

    			const bar1_changes = {};
    			if (dirty & /*tracksProgress*/ 16) bar1_changes.width = /*tracksProgress*/ ctx[4];
    			bar1.$set(bar1_changes);

    			if (dirty & /*queriesText*/ 4) {
    				set_input_value(textarea0, /*queriesText*/ ctx[2]);
    			}

    			if (dirty & /*tracksText*/ 8) {
    				set_input_value(textarea1, /*tracksText*/ ctx[3]);
    			}

    			if (!current || dirty & /*authed, tracksProgress*/ 18 && button1_disabled_value !== (button1_disabled_value = !/*authed*/ ctx[1] || 0 < /*tracksProgress*/ ctx[4] && /*tracksProgress*/ ctx[4] < 1)) {
    				prop_dev(button1, "disabled", button1_disabled_value);
    			}

    			const bar2_changes = {};
    			if (dirty & /*addProgress*/ 64) bar2_changes.width = /*addProgress*/ ctx[6];
    			bar2.$set(bar2_changes);

    			if (dirty & /*playlistName*/ 32 && input1.value !== /*playlistName*/ ctx[5]) {
    				set_input_value(input1, /*playlistName*/ ctx[5]);
    			}

    			if (!current || dirty & /*authed, addProgress*/ 66 && button2_disabled_value !== (button2_disabled_value = !/*authed*/ ctx[1] || 0 < /*addProgress*/ ctx[6] && /*addProgress*/ ctx[6] < 1)) {
    				prop_dev(button2, "disabled", button2_disabled_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bar0.$$.fragment, local);
    			transition_in(bar1.$$.fragment, local);
    			transition_in(bar2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bar0.$$.fragment, local);
    			transition_out(bar1.$$.fragment, local);
    			transition_out(bar2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(bar0);
    			destroy_component(bar1);
    			destroy_component(bar2);
    			mounted = false;
    			run_all(dispose);
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

    function clump(arr, size) {
    	const result = [];

    	for (let i = 0; i < arr.length; i += size) {
    		result.push(arr.slice(i, i + size));
    	}

    	return result;
    }

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

    	let clientId = "5dfa309106f847819f19d5af2dd774cb";
    	let authed = false;
    	let queriesText = ["Rick Astley Never Gonna Give You Up", "..."].join("\n");
    	let tracksText = "";
    	let tracksProgress = 0;
    	let playlistName = "Test";
    	let addProgress = 0;
    	const delay = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

    	const paramsToObj = params => {
    		const result = {};

    		params.forEach((value, key) => {
    			result[key] = value;
    		});

    		return result;
    	};

    	const api = (endPoint, token) => __awaiter(void 0, void 0, void 0, function* () {
    		const url = `https://api.spotify.com/v1/${endPoint}`;

    		const response = yield fetch(url, {
    			headers: { Authorization: "Bearer " + token }
    		});

    		return yield response.json();
    	});

    	const apiBody = (endPoint, token, body, method) => __awaiter(void 0, void 0, void 0, function* () {
    		const url = `https://api.spotify.com/v1/${endPoint}`;

    		const response = yield fetch(url, {
    			method: method !== null && method !== void 0 ? method : "POST",
    			headers: {
    				"Content-Type": "application/json",
    				Authorization: "Bearer " + token
    			},
    			body: JSON.stringify(body)
    		});

    		return yield response.json();
    	});

    	const authClick = () => {
    		const redirectUri = "http://localhost:5500/public/index.html";

    		const authUrl = "https://accounts.spotify.com/authorize?" + [
    			`client_id=${clientId}`,
    			"response_type=token",
    			`redirect_uri=${encodeURI(redirectUri)}`,
    			"scope=playlist-read-private playlist-modify-public playlist-modify-private"
    		].join("&");

    		window.location.href = authUrl;
    	};

    	const tracksClick = () => {
    		const tracksRun = () => __awaiter(void 0, void 0, void 0, function* () {
    			const authResult = window.location.href.replace(/.*#/, "");
    			const token = paramsToObj(new URLSearchParams(authResult)).access_token;
    			const searchUrls = queriesText.split("\n").map(q => encodeURI(`search?q=${q}&type=track`));
    			const clumpedSearchUrls = clump(searchUrls, 100);
    			$$invalidate(3, tracksText = "");
    			$$invalidate(4, tracksProgress = 0.01);

    			for (const i in clumpedSearchUrls) {
    				const searchUrlClump = clumpedSearchUrls[i];
    				const tracks = yield Promise.all(searchUrlClump.map(s => api(s, token)));

    				const trackIds = tracks.map((t, i) => {
    					const { items } = t.tracks;
    					if (items.length) return items[0].id;
    					throw new Error(`Couldn't find ${searchUrlClump[i]}`);
    				});

    				$$invalidate(3, tracksText += trackIds.join("\n") + "\n");
    				$$invalidate(4, tracksProgress = (parseInt(i) + 1) / clumpedSearchUrls.length);
    			}
    		});

    		tracksRun().catch(err => {
    			console.error(err);
    		});
    	};

    	const addClick = () => {
    		const addRun = () => __awaiter(void 0, void 0, void 0, function* () {
    			const authResult = window.location.href.replace(/.*#/, "");
    			const token = paramsToObj(new URLSearchParams(authResult)).access_token;
    			const myPlaylists = yield api("me/playlists", token);
    			const playlistId = myPlaylists.items.filter(p => p.name === playlistName)[0].id;
    			const clumps = clump(tracksText.split("\n"), 100);
    			$$invalidate(6, addProgress = 0.01);

    			for (const i in clumps) {
    				const ids = clumps[i].filter(id => id.trim().length);

    				yield apiBody(`playlists/${playlistId}/tracks`, token, {
    					uris: ids.map(id => `spotify:track:${id.trim()}`)
    				});

    				$$invalidate(6, addProgress = (parseInt(i) + 1) / clumps.length);
    			}
    		});

    		addRun().catch(err => {
    			console.error(err);
    		});
    	};

    	onMount(() => __awaiter(void 0, void 0, void 0, function* () {
    		if (window.location.href.includes("#")) {
    			yield delay(1);
    			$$invalidate(1, authed = true);
    		}
    	}));

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		clientId = this.value;
    		$$invalidate(0, clientId);
    	}

    	function textarea0_input_handler() {
    		queriesText = this.value;
    		$$invalidate(2, queriesText);
    	}

    	function textarea1_input_handler() {
    		tracksText = this.value;
    		$$invalidate(3, tracksText);
    	}

    	function input1_input_handler() {
    		playlistName = this.value;
    		$$invalidate(5, playlistName);
    	}

    	$$self.$capture_state = () => ({
    		__awaiter,
    		onMount,
    		Bar,
    		clientId,
    		authed,
    		queriesText,
    		tracksText,
    		tracksProgress,
    		playlistName,
    		addProgress,
    		delay,
    		paramsToObj,
    		api,
    		apiBody,
    		clump,
    		authClick,
    		tracksClick,
    		addClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('clientId' in $$props) $$invalidate(0, clientId = $$props.clientId);
    		if ('authed' in $$props) $$invalidate(1, authed = $$props.authed);
    		if ('queriesText' in $$props) $$invalidate(2, queriesText = $$props.queriesText);
    		if ('tracksText' in $$props) $$invalidate(3, tracksText = $$props.tracksText);
    		if ('tracksProgress' in $$props) $$invalidate(4, tracksProgress = $$props.tracksProgress);
    		if ('playlistName' in $$props) $$invalidate(5, playlistName = $$props.playlistName);
    		if ('addProgress' in $$props) $$invalidate(6, addProgress = $$props.addProgress);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		clientId,
    		authed,
    		queriesText,
    		tracksText,
    		tracksProgress,
    		playlistName,
    		addProgress,
    		authClick,
    		tracksClick,
    		addClick,
    		input0_input_handler,
    		textarea0_input_handler,
    		textarea1_input_handler,
    		input1_input_handler
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


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
    function children(element) {
        return Array.from(element.childNodes);
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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

    /* src/App.svelte generated by Svelte v3.42.3 */

    const { Error: Error_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let div0;
    	let t2;
    	let t3;
    	let t4;
    	let div1;
    	let t5;
    	let t6;
    	let t7;
    	let button0;
    	let t9;
    	let button1;
    	let t11;
    	let button2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "LI-2";
    			t1 = space();
    			div0 = element("div");
    			t2 = text("Authed: ");
    			t3 = text(/*authed*/ ctx[0]);
    			t4 = space();
    			div1 = element("div");
    			t5 = text("Status: ");
    			t6 = text(/*status*/ ctx[1]);
    			t7 = space();
    			button0 = element("button");
    			button0.textContent = "Auth";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Tracks";
    			t11 = space();
    			button2 = element("button");
    			button2.textContent = "Add";
    			add_location(h1, file, 130, 2, 4984);
    			add_location(div0, file, 131, 2, 5000);
    			add_location(div1, file, 132, 2, 5030);
    			add_location(button0, file, 133, 2, 5060);
    			add_location(button1, file, 134, 2, 5105);
    			add_location(button2, file, 135, 2, 5154);
    			add_location(main, file, 129, 0, 4975);
    		},
    		l: function claim(nodes) {
    			throw new Error_1("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);
    			append_dev(main, div0);
    			append_dev(div0, t2);
    			append_dev(div0, t3);
    			append_dev(main, t4);
    			append_dev(main, div1);
    			append_dev(div1, t5);
    			append_dev(div1, t6);
    			append_dev(main, t7);
    			append_dev(main, button0);
    			append_dev(main, t9);
    			append_dev(main, button1);
    			append_dev(main, t11);
    			append_dev(main, button2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*authClick*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*tracksClick*/ ctx[3], false, false, false),
    					listen_dev(button2, "click", /*addClick*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*authed*/ 1) set_data_dev(t3, /*authed*/ ctx[0]);
    			if (dirty & /*status*/ 2) set_data_dev(t6, /*status*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
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

    const redirectUri = "http://localhost:5500/public/index.html";

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

    	let { auth } = $$props;
    	let { data } = $$props;
    	let authed = false;
    	let status = "";

    	const authUrl = "https://accounts.spotify.com/authorize?" + [
    		`client_id=${auth.clientId}`,
    		"response_type=token",
    		`redirect_uri=${encodeURI(redirectUri)}`,
    		"scope=playlist-read-private playlist-modify-public playlist-modify-private"
    	].join("&");

    	const toBase64 = x => Buffer.from(x).toString("base64");

    	const authClick = () => {
    		window.location.href = authUrl;
    	};

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

    	const copy = text => {
    		const el = document.createElement("textarea");
    		el.value = text;
    		document.body.appendChild(el);
    		el.select();
    		document.execCommand("copy");
    		document.body.removeChild(el);
    	};

    	if (window.location.href.includes("#")) {
    		authed = true;
    	}

    	const tracksClick = () => {
    		const tracksRun = () => __awaiter(void 0, void 0, void 0, function* () {
    			$$invalidate(1, status = "fetching");
    			const authResult = window.location.href.replace(/.*#/, "");
    			const token = paramsToObj(new URLSearchParams(authResult)).access_token;
    			const queries = data.names.map(s => `${s.song} ${s.artist.replace(/&.*/g, "").replace(/\sx\s.*/, "")}`.replace(/\(.*?\)/g, "").replace(/\s\s/g, " ").trim());
    			const searchUrls = queries.map(q => encodeURI(`search?q=${q}&type=track`));
    			const clumpedSearchUrls = clump(searchUrls, 100);
    			let result = "";

    			for (const i in clumpedSearchUrls) {
    				const searchUrlClump = clumpedSearchUrls[i];

    				const tracks = yield Promise.all(searchUrlClump.map(s => // TODO: Delete `Jolen` thing
    				s.includes("Jolen")
    				? {
    						tracks: {
    							items: [{ id: "1nuDf5WpelCulE091ZK8nT" }]
    						}
    					}
    				: api(s, token)));

    				const trackIds = tracks.map((t, i) => {
    					const { items } = t.tracks;
    					if (items.length) return items[0].id;
    					throw new Error(`couldn't find ${searchUrlClump[i]}`);
    				});

    				result += trackIds.join(",");
    			}

    			copy(result);
    			$$invalidate(1, status = "copied");
    		});

    		tracksRun().catch(err => {
    			$$invalidate(1, status = err);
    			console.error(err);
    		});
    	};

    	const addClick = () => {
    		const addRun = () => __awaiter(void 0, void 0, void 0, function* () {
    			$$invalidate(1, status = "fetching");
    			const authResult = window.location.href.replace(/.*#/, "");
    			const token = paramsToObj(new URLSearchParams(authResult)).access_token;
    			const myPlaylists = yield api("me/playlists", token);
    			const playlistId = myPlaylists.items.filter(p => p.name === "LI-2")[0].id;
    			const clumps = clump(data.ids.map(id => `spotify:track:${id}`), 50);

    			for (const i in clumps) {
    				const uris = clumps[i];
    				yield apiBody(`playlists/${playlistId}/tracks`, token, { uris });
    				$$invalidate(1, status = `${i} of ${clumps.length - 1}`);
    			}
    		});

    		addRun().catch(err => {
    			$$invalidate(1, status = err);
    			console.error(err);
    		});
    	};

    	const writable_props = ['auth', 'data'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('auth' in $$props) $$invalidate(5, auth = $$props.auth);
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
    	};

    	$$self.$capture_state = () => ({
    		__awaiter,
    		auth,
    		data,
    		authed,
    		status,
    		redirectUri,
    		authUrl,
    		toBase64,
    		authClick,
    		paramsToObj,
    		api,
    		apiBody,
    		copy,
    		clump,
    		tracksClick,
    		addClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('__awaiter' in $$props) __awaiter = $$props.__awaiter;
    		if ('auth' in $$props) $$invalidate(5, auth = $$props.auth);
    		if ('data' in $$props) $$invalidate(6, data = $$props.data);
    		if ('authed' in $$props) $$invalidate(0, authed = $$props.authed);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [authed, status, authClick, tracksClick, addClick, auth, data];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { auth: 5, data: 6 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*auth*/ ctx[5] === undefined && !('auth' in props)) {
    			console_1.warn("<App> was created without expected prop 'auth'");
    		}

    		if (/*data*/ ctx[6] === undefined && !('data' in props)) {
    			console_1.warn("<App> was created without expected prop 'data'");
    		}
    	}

    	get auth() {
    		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set auth(value) {
    		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get data() {
    		throw new Error_1("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set data(value) {
    		throw new Error_1("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var data = {
        names: [
            "Becky Hill & David Guetta - 'Remember (David Guetta VIP Remix)'",
            "Joel Corry & MNEK - 'Head & Heart'",
            "Sonny Fodera & Ella Eyre - 'Wired'",
            "Galantis, David Guetta & Little Mix - 'Heartbreak Anthem'",
            "Ava Max - 'Salt'",
            "Mabel - 'Let Them Know'",
            "Bishop Briggs - 'HIGHER'",
            "Bad Boy Chiller Crew - 'Free (feat. Chris Nichols)'",
            "Switch Disco - 'Everything'",
            "Luis Fonsi - 'Despacito (feat. Daddy Yankee)'",
            "Dagny - 'Somebody (Acoustic)'",
            "Kina Grannis - 'Can't Help Falling In Love'",
            "Morgan Harper Jones - 'I Wanna Dance with Somebody (Who Loves Me)'",
            "Clinton Kane - 'I Guess I'm In Love'",
            "Nina Nesbitt - 'Summer Fling'",
            "PHOEBE ∆X∆ - 'Young Blood'",
            "Anton Powers x Joe Stone - 'Do Me Right'",
            "Little Mix & CNCO - 'Reggaeton Lento (Remix)'",
            "Sia & David Guetta - 'Floating Through Space'",
            "Best Friend - 'Back N Fourth'",
            "Cash Cash - 'Take Me Home (feat. Bebe Rexha)'",
            "Andra Day - 'Rise Up'",
            "Declan J Donovan - 'I'll Be There Love'",
            "BEKA - 'My One'",
            "Lucas & Steve - 'Another Life (feat. Alida)'",
            "SUPER-Hi & Neeka - 'Following the Sun'",
            "Dutchkid - 'Say'",
            "NEEDTOBREATHE - 'I Am Yours'",
            "summersets - 'only you (feat. Kalle Mattson)'",
            "Dario G - 'You Make the Sunrise (feat. Leslie P George)'",
            "Hannah Grace - 'Praise You'",
            "Ludovico Einaudi - 'Nightbook'",
            "Lea Heart - 'A Million Goodbyes'",
            "Christian Reindi - 'Hurt (feat. Lloren)'",
            "JENNA - 'The Same'",
            "Tommee Profitt - 'Shallow (feat. Fleurie)'",
            "Y.V.E. 48 - 'Still Think About It (Extended Mix)'",
            "Olivia Rodrigo - 'Drivers License'",
            "Hailee Steinfeld - 'Wrong Direction'",
            "Karen Harding - 'It Must Have Been Love'",
            "Calum Scott - 'Biblical'",
            "Anne-Marie - 'Her'",
            "Benedict Cork & Mahogany - 'Heaven Is a Place on Earth'",
            "Anabel Englund - 'Picture Us (NERVO Remix)'",
            "P!nk - 'A Million Dreams'",
            "Luz - 'i'm lonely'",
            "Danielle Juhre - 'You & I'",
            "Nick Wilson - 'Think Twice'",
            "The Piano Guys - 'Rewrite the Stars'",
            "Duomo - 'Wildest Dreams (Taylor Swift Cover)'",
            "Harry Pane - 'Another Page (feat. Maria Franowski)'",
            "Camila Cabello - 'Consequences'",
            "Alex Hobson & Talia Mar - 'Good on You'",
            "Tyler Shaw - 'I See You'",
            "James Smith - 'Got the Love'",
            "Sigala - 'We Got Love [Joel Corry Remix] (feat. Ella Henderson)'",
            "Dustin O'Halloran - 'We Move Lightly'",
            "Gabe Coulter - 'You'",
            "Christian Reindl - 'Into the Fire (Epic Remix) (feat. Lloren)'",
            "Zoe Wees - 'Control'",
            "Faouzia & John Legend - 'Minefields'",
            "Natali Felicia - 'Easy Ride'",
            "YONAKA - 'Call Me a Saint'",
            "Strange Fruits Music, Steve Void & DMNDS - 'Mr. Saxobeat'",
            "*NSYNC - 'Bye Bye Bye'",
            "Sonny Fodera & Just Kiddin - 'Closer (feat. Lilly Ahlberg)'",
            "Jason Derulo - 'Lifestyle (feat. Adame Levine)'",
            "Boney M. - 'Daddy Cool (Nick Raider Radio Mix)'",
            "The Ronettes - 'Be My Baby'",
            "Griff - 'One Foot In Front Of The Other'",
            "Brandi Carlile - 'All You Need Is Love'",
            "Anne-Marie - 'Beautiful'",
            "Tom Jones - 'It's Not Unusual'",
            "Anne-Marie x KSI x Digital Farm Animals - 'Don't Play'",
            "Sergio Mendes - 'Mas Que Nada (feat. The Black Eyed Peas)'",
            "Mark Ronson - 'Uptown Funk (feat. Bruno Mars)'",
            "BTS - 'Dynamite'",
            "THAT KIND - 'Summer In Love'",
            "newfamiliar - 'Here for You'",
            "Julius Cowdrey - 'Take Me Home'",
            "Holly Humberstone - 'Falling Asleep at the Wheel'",
            "Coolio - 'Fantastic Voyage'",
            "Lucy May Walker - 'Not Around'",
            "Hidden Citizens & Hael - 'All for One'",
            "Summer Kennedy - 'Legends'",
            "UNSECRET - 'No Sanctuary (feat. Sam Tinnesz & Fleurie)'",
            "Amber Run - 'Worship'",
            "Grafitti Ghosts - 'I'm Coming for You'",
            "Gryffin - 'Body Back (feat. Maia Wright)'",
            "220 KID & JC Stewart - 'Too Many Nights'",
            "Yigaa - 'Good Enough'",
            "Olivia Rodrigo - 'favorite crime'",
            "Linkin Park - 'What I've Done'",
            "Joy Oladokun - 'sunday'",
            "UNSECRET - 'No Good (feat. Ruelle)'",
            "Zara Larsson - 'I Need Love'",
            "Kygo & Whitney Houston - 'Higher Love'",
            "Noizu - 'Summer 91 (Looking Back)'",
            "AJ Tracey - 'Dinner Guest (feat. MoStack)'",
            "Cheat Codes & AJ Mitchell - 'Hate You + Love You'",
            "Anne-Marie - 'Breathing'",
            "Lusaint - 'Crazy In Love'",
            "Sia - 'Miracle'",
            "The Beach Boys - 'Good Vibrations'",
            "Joel Corry & Jax Jones - 'OUT OUT (feat. Charli XCX & Saweetie)'",
            "Little Mix - 'A Mess (Happy 4 U)'",
            "Coldplay - 'High Power'",
            "Lizzo - 'Juice'",
            "Michael Walls - 'Fallin'",
            "KC Lights - 'Cold Light (feat. Leo Stannard)'",
            "Jerry Williams - 'Velcro'",
            "Zedd & Elley Duhé - 'Happy Now'",
            "Ciara - '1, 2 Step (feat. Missy Elliott)'",
            "Karen Harding & Digital Farm Animals - 'Undo My Heart'",
            "Bonnie Tyler - 'Holding Out For A Hero'",
            "Nathan Evans - 'Wellerman (220 KID & Billen Ted TikTok Remix)'",
            "Mousse T. - 'Horny '98 (feat. Hot 'n' Juicy)'",
            "Bruno Mars, Anderson .Paak & Silk Sonic - 'Leave the Door Open'",
            "Pitbull - 'Timber (feat. Kesha)'",
            "Camila Cabello - 'Havana (feat. Young Thug)'",
            "Jessie J, Ariana Grande & Nicki Minaj - 'Bang Bang'",
            "Little Mix - 'Power (feat. Stormzy)'",
            "Nicole Scherzinger - 'Wet'",
            "Rihanna - 'S&M'",
            "Jessica Simpson - 'These Boots Are Made for Walkin''",
            "Nelly Furtado - 'Maneater'",
            "Rina Esposito & Adriano Pepe - 'Free'",
            "HAEVN - 'Where The Heart Is'",
            "KSHMR - 'Ready To Love'",
            "Craig Armstrong - 'Glasgow Love Theme'",
            "BTS - 'Butter'",
            "John Clapper - 'Good Riddance (Time of Your Life)'",
            "Bomfunk MC's - 'Freestyler'",
            "Billy Lockett - 'Hard Act to Follow'",
            "Fleurie - 'Love and War'",
            "Wrabel - 'nothing but the love'",
            "Post Tense - 'To Be with You'",
            "Galantis & Hook N Sling - 'Never Felt a Love Like This (feat. Dotan)'",
            "Dermot Kennedy - 'Dancing Under Red Skies'",
            "Mali-Koa - 'Hunger'",
            "Hidden Citizens - 'Nowhere to Run (Epic Trailer Version) (feat. Keeley Bumford)'",
            "Icona Pop - 'Next Mistake (Joel Corry Extended Mix)'",
            "Vantage - 'Think I'm In Love (feat. Todd Edwards)'",
            "Sia - '1+1'",
            "Halsey - 'Finally // beautiful stranger'",
            "Blame Jones - 'Promises (Acoustic)'",
            "Karen Harding, Future Kings & L'Tric - 'Rely'",
            "Clean Bandit & Topic - 'Drive (feat. Wes Nelson)'",
            "The White Stripes - 'Seven Nation Army'",
            "Sunset Strippers - 'Falling Stars'",
            "LMFAO - 'Sexy and I Know It'",
            "Tom Jones & Mouse T. - 'Sex Bomb'",
            "Punctual - 'Imagine'",
            "Galantis - 'Holy Water'",
            "Clean Bandit & Mabel - 'Tick Tock (feat. 24kGoldn)'",
            "Donna Summer - 'Hot Stuff'",
            "Dillon Francis & Shift K3Y - 'Love Me Better (feat. Marc E. Bassy)'",
            "Zara James - 'In the Air Tonight'",
            "Aquilo - 'Silhouette'",
            "Sody - 'Nothing Ever Changes'",
            "Nathan C & Yola Recoba - 'Only Me'",
            "Syn Cole - 'Crawl (feat. Sarah Close)'",
            "Underworld - 'Born Slippy (Nuxx)'",
            "Billy Locket & Violet Skies - 'Talk (Acoustic)'",
            "Eylie - 'Singing Without You'",
            "Dotan - 'Numb'",
            "Santino Le Saint - 'Sleepless Nights'",
            "Power-Haus, Christian Rendi & Lloren - 'The Storm'",
            "Timmy Trumpet & The Golden Army - 'Mufasa (Extended Remix)'",
            "Summer Kennedy - 'Bad Things'",
            "Tommee Profitt - 'Undone (feat. Fleurie)'",
            "2WEI - 'Pushin On (feat. Marvin Brooks)'",
            "Kat Meoz - 'Trouble'",
            "Tobtok, AKA George, Oliver Nelson - 'Something 'Bout The Music'",
            "Sonny Fodera & Ella Eyre - 'Wired'",
            "James Smith - 'My Oh My'",
            "Duncan Laurance - 'Arcade (feat. FLETCHER)'",
            "Billie Eilish - 'Ocean Eyes'",
            "Carmody - 'Paradise'",
            "Blame Jones - 'Love At First Sight (Acoustic)'",
            "Captain Cuts & Zookëper - 'Do You Think About Me (feat. Georgia Ku)'",
            "Ryan Shepherd - 'Hello Sunday (feat. Caitlyn Scarlett)'",
            "Alok & THRDLIFE - 'Hear Me Tonight'",
            "LÉON - 'Falling Apart'",
            "Dotan - 'There Will Be a Way'",
            "EVER - 'Indigo Sky'",
            "You Me At Six - 'Spell It Out'",
            "Hana Lili - 'Stay'",
            "49th & Main - 'Catching Eyes (Tom Ferry Remix)'",
            "Georgia Twinn - 'Raccoons'",
            "Charlie Puth - 'We Don't Talk Anymore (feat. Selena Gomez)'",
            "Billie Eilish - 'NDA'",
            "Miley Cyrus - 'Mother's Daughter'",
            "Jetta - 'I'd Love to Change the World (Matstubs Remix)'",
            "Benny Benassi - 'Cinema (feat. Gary Go)'",
            "UNOMAS & Daramola - 'Blessed'",
            "Nick Wilson - 'Lead Me to the Water'",
            "Dua Lipa - 'No Goodbyes'",
            "Joy Oladokun - 'breathe again'",
            "Lloren - 'The Start (Stripped)'",
            "Saint Raymond - 'Nightcrawling'",
            "Gabrielle Aplin - 'Run For Cover'",
            "Soulja Boy Tell'em - 'Crank That (Soulja Boy)'",
            "Frank Sinatra - 'You Make Me Feel So Young'",
            "Bshp - 'Passionfruit'",
            "Michael Baker - 'Got to Be Real'",
            "Sarah Close - 'Forgive or Forget'",
            "Disciples - 'I Got You'",
            "Greta Isaac - 'Like Me'",
            "Avril Lavigne - 'Alone'",
            "Sam and the Womp - 'Bom Bom'",
            "Robin Schulz & Wes - 'Alane'",
            "Dua Lipa - 'Love Again'",
            "Ben Pearce (feat. Moss Kena) - 'Snakes & Ladders'",
            "Issey Cross - 'Hot N' Cold'",
            "Dotan - 'Letting Go'",
            "Sleeping Wolf - 'Greyscale'",
            "Sody - 'Love's a Waste'",
            "Clara Mae - 'Drunk On Emotions (Stripped)'",
            "Fleurie - 'Breathe'",
            "Claudia Valentina - 'Seven'",
            "Ruelle - 'Where We Come Alive'",
            "Sarah Close - 'Only You'",
            "Shaefri - 'Say You'll Be There'",
            "MAX & Ali Gatie - 'Butterflies'",
            "Royal Blood - 'All We Have Is Now'",
            "Emily Burns - 'Latch'",
            "Mabel - 'Let Them Know'",
            "Mabel - 'Mad Love'",
            "Mabel - 'Don't Call Me Up'",
            "Voost - 'Taste of Your Love (feat. KOOLKID)'",
            "Kygo & Sasha Alex Sloan - 'I'll Wait'",
            "Jolen - 'Waste My Time'",
            "Fleurie - 'Hurts Like Hell'",
            "Robinson - 'Watching You'",
            "Tom Speight - 'Feel the Night'",
            "Alicia Keys - 'Love Looks Better'",
            "mxmtoon - 'Fever Dream'",
            "Gabrielle Aplin & Nick Wilson - 'Love Can Be So Lonely, Sometimes'",
            "Au/Ra - 'Screw Feelings'",
            "Brick - 'Dazz (Dazz Disco Mix)'",
            "Matthew V - 'Always Be My Baby'",
            "Olivia Rodrigo - 'traitor'",
            "Zac Pajak - 'Silver Lining'",
            "Laura Greaves & Lhotse - 'Promises'",
            "Lea-D - 'Landscape'",
            "Josh Daniel - 'What Is Love'",
            "Stevie Appleton - 'Paradise (with Sam Feldt)'",
            "Sody - 'Old Flame'",
            "Camila Cabello - 'I Have Questions'",
            "Harrison Storm - 'Falling Down'",
            "The Prodigy - 'Invaders Must Die'",
            "Jet - 'Are You Gonna Be My Girl (Alternate Version)'",
            "Griff - 'Love Is a Compass'",
            "Sigrid - 'Dynamite (Acoustic)'",
            "Hidden Citizens - 'Nothing Is As It Seems (feat. Ruelle)'",
            "Mimi Webb - 'I'll Break My Heart Again'",
            "Rag'n'Bone & P!nk - 'Anywhere Away from Here'",
            "Matt Johnson & Blame Jones - 'For You (Acoustic Piano)'",
            "Hidden Citizens - 'Don't Speak (Epic Trailer Version) (feat. Tim Halperin)'",
            "Tim Halperin - 'Love On Top'",
            "The Band CAMINO & Chelsea Cutler - 'Crying Over You'",
            "James TW - 'Hopeless Romantics'",
            "Emilia Tarrant - 'Here You Are, Again'",
            "Kodaline - 'Say Something'",
            "Marilyn Manson - 'Tainted Love'",
            "Aaron Smith - 'In My Way'",
            "Blame Jones - 'Young Hearts Run Free (Acoustic)'",
            "Freya Ridings - 'Maps'",
            "Sody - 'What We Had'",
            "Marshmello x Jonas Brothers - 'Leave Before You Love Me'",
            "LÉON - 'Chasing a Feeling'",
            "Tom Speight - 'Soak Up'",
            "Krimsonn - 'I Won't Lie'",
            "Jubel - 'Dancing in the Moonlight (feat. NEIMY)'",
            "Birdy - 'Loneliness'",
            "Kygo & Zac Brown - 'Someday'",
            "Olivia Rodrigo - 'brutal'",
            "Bow Anderson - 'Hate That I Fell In Love With You'",
            "Summer Kennedy - 'Now's The Time'",
            "KSI ft. Craig David & Digital Farm Animals - 'Really Love'",
            "J2 - 'Can't Get You Out of My Head'",
            "Timmy Trumpet & Savage - 'Freaks'",
            "MIYA MIYA - 'Want You'",
            "MOTi - 'In My Head (On My Mind)'",
            "Nathan Evans - 'Wellerman (Sea Shanty)'",
            "Sam Feldt & Sigma Feat. Gia Koka - '2 Hearts'",
            "Blinkie - 'Little Love (feat. Grace Tither)'",
            "James Hype - 'Good Luck (feat. Pia Mia)'",
            "Becky Hill & Sigala - 'Heaven On My Mind'",
            "Zara Larsson - 'Poster Girl'",
            "VINAE & Le Pedre - 'I Was Made (Extended Mix)'",
            "Tony Perry - 'Free for Sweet Harmony (DanceLab Mix)'",
            "HUX - 'Lemonade'",
            "Anna of the North - 'Believe'",
            "Zayde Wølf - 'Still Fighting for It'",
            "Avi Kaplan - 'Change on the Rise'",
            "Charlotte Campbell - 'Blur'",
            "Nathan Dawe x Anne-Marie x MoStack - 'Way Too Long'",
            "DMNDS, Strange Fruits Music & Fallen Roses - 'Calabria (feat. Lujavo & Nito-Onna)'",
            "Lady Bri - 'So Good'",
            "Digital Farm Animals - 'Last Night (feat. HARLEE)'",
            "Luz - 'the author'",
            "Sigala & James Arthur - 'Lasting Lover'",
            "Wretch 32 - 'Traktor (feat. L)'",
            "Since September - 'Let You Go'",
            "Tiësto & Sevenn - 'Boom'",
            "Active Child - 'All Eyes on You'",
            "Leanna Firestone - 'Grow As We Go'",
            "Shadowlark - 'Come Around Here'",
            "Zara Larsson - 'Look What You've Done'",
            "Sam Ryder - 'Whirlwind'",
            "Galantis, Pink Sweat$ & Ship Wrek - 'Only a Fool'",
            "Micky - 'True Colours'",
            "The Hives - 'Tick Tick Boom'",
            "Lucy May Walker - ‘Without Him’",
            "2WEI ft. Jon & Bri Bryant - ‘Hit The Road Jack’",
            "Maisie Peters - ‘Daydreams’",
            "Emilia Tarrant - ‘Honeymoon Phase’",
            "Daya - ‘The Difference’",
            "Olivia Rodrigo - ‘1 step forward, 3 steps back’",
            "Papa Zeus - ‘Can’t Stop (Oh No)’",
            "Zayde Wølf - ‘Madness’",
            "Shaefri - ‘Home’",
            "Birdy - ‘Surrender’",
            "The Paper Kites ft. Lucy Rose - ‘For All You Give’",
            "Delilah Montagu - ‘Lost Keys’",
            "Royal Deluxe - ‘Fighter’",
            "Sonny Fodera & KOLIDESCOPES - 'Nah (feat. Sinead Harnett)'",
            "London Grammar - 'Lose Your Head'",
            "Michael Baker - 'Ferris Wheel'",
            "Maisie Peters - 'Favourite Ex'",
            "Kat Leon - 'Survive'",
            "Ruelle - 'The Other Side'",
            "Hidden Citizens - 'It's a Sin (Epic Trailer Version)'",
            "London Grammar - 'Call Your Friends'",
            "Zayde Wølf & Fjøra - 'Hurricane'",
            "Majestic x Boney M. - 'Rasputin'",
            "Tom Grennan - 'Little Bit of Love'",
            "Jerry Williams - 'Babe'",
            "Harddope & Callum Beattie - 'Lost Souls'",
            "The Weeknd - 'Save Your Tears'",
            " - 'Somebody That I Used to Know'",
            "Billie Eilish - 'Lost Cause'",
            "Missy Elliott - 'We Run This'",
            "Julia Michaels - 'Little Did I Know'",
            "The Pussycat Dolls - 'React'",
            "DNCE - 'Kissing Strangers (feat. Nicki Minaj)'",
            "Kygo & Tina Turner - 'What's Love Got to Do with It'",
            "Ava Max - 'Kings & Queens'",
            "Carly Rae Jepsen - 'This Kiss'",
            "Tungevaag - 'Young Summer (Extended Mix)'",
            "A7S - 'Nirvana'",
            "Michael Calfan - 'Imagining (feat. Gabrielle Aplin)'",
            "Jay Pryor - 'By Now'",
            "Oasis - 'Fuckin' in the Bushes'",
            "UNSECRET - 'No Good (feat. Ruelle)'",
            "Oliver Heldens & Party Pupils - 'Set Me Free (feat. MAX)'",
            "Lady Bri - 'It's Like Whoa!'",
            "Le Pedre - 'Gimme! Gimme! Gimme! (A Man After Midnight)'",
            "Cats the Musical - 'Memory'",
            "Tinie Tempah - 'Whoppa (feat. Sofia Reyes & Farina)'",
            "Robin Schulz - 'In Your Eyes (feat. Alida)'",
            "Joji - 'Run'",
            "Billie Eilish - 'when the party's over'",
            "Sigala & Becky Hill - 'Wish You Well (Acoustic)'",
            "JC Stewart - 'Loud'",
            "Zella Day - 'East of Eden'",
            "Tom Speight - 'Medicine'",
            "Mimi Webb - 'Dumb Love'",
            "Hidden Citizens - 'Here We Stand (feat. Svrcina)'",
            "JAY-Z & Kanye West - 'N****s in Paris'",
            "Royal Deluxe - 'Revolution'",
            "The Phantoms - 'Stronger (feat. Black Violin)'",
            "Secondcity & Paul Woolford - 'All I Want (feat. Andrea Martin)'",
            "Tones And I - 'Cloudy Day'",
            "Emma McGrath - 'Fall with You'",
            "Sigala & Shaun Frank & Flo Rida - 'You Don't Know Me (feat. Delaney Jane)'",
            "Tom Speight - 'Save Tonight (feat. Lydia Clowes)'",
            "beaux - 'I Don't Want to Make It Alone, I Want to Make It with You'",
            "Noizu - 'Summer 91 (Looking Back)'",
            "Layla - 'Oh My Love'",
            "Justin Bieber - 'Holy (feat. Chance the Rapper)'",
            "Good Charlotte - 'Lifestyles of the Rich & Famous'",
            "Zayde Wølf - 'Brand New Thing'",
            "Syn Cole - 'Feels Like Love (feat. MIYA MIYA)'",
            "MK - '2AM (feat. Carla Monroe)'",
            "KOLIDESCOPES & Gavin James - 'All for You'",
            "Holly Humberstone - 'The Walls Are Way Too Thin'",
            "Anne-Marie x KSI x Digital Farm Animals - 'Don't Play'",
            "Zayde Wølf - 'Cold-Blooded'",
            "Chase & Status - 'Let You Go (feat. Mali)'",
            "Miley Cyrus - 'Gimme What I Want'",
            "Majestic - 'Me & U (feat. Kelsey)'",
            "Chumbawumba - 'Tubthumping'",
            "Dua Lipa - 'Don't Start Now'",
            "S Club 7 - 'Reach'",
            "Drenchill - 'Freed From Desire (feat. Indiiana)'",
            "Jet - 'Are You Gonna Be My Girl?'",
            "DJ Ötzi - 'Hey Baby'",
            "Sigala & Rita Ora - 'You for Me'",
            "Gabrielle Aplin & JP Cooper - 'Losing Me'",
            "Naomi Kimpenu - 'Only'",
            "Matthew Nolan - 'Don't Cry Over Me'",
            "Rhys Lewis - 'The Sun Will Rise'",
            "Tim Halperin - 'The Reason'",
            "Nirvana - 'Heart-Shaped Box'",
            "Barns Courtney - 'Champion'",
            "Mountains vs. Machines - 'The Time Is Now'",
            "Zayde Wølf - 'Breathing Oxygen'",
            "Blithe - 'Say Your Prayers'",
            "Phobia - 'Nothing But Thieves'",
            "Mr. Belt & Wezol & Jack Wins - 'One Thing (Extended Mix)'",
            "NEEDTOBREATHE - 'Seasons'",
            "Parx - 'Finally'",
            "Tones & I - 'Fly Away'",
            "Voost - 'Taste of Your Love (feat. KOOLKID)'",
            "David Guetta & Sia - 'Let's Love'",
            "Chalotte Campbell - 'Mr. Brightside'",
            "Clément Leroux - 'U Got My Heart [Extended Mix] (feat. Emma Hoet)'",
            "Frances - 'Grow'",
            "Kygo & OneRepublic - 'Lose Somebody'",
            "Traffic - 'Dear Mr. Fantasy'",
            "Tom Walker - 'Better Half of Me'",
            "Young Bombs - 'Better Day (feat. Aloe Blacc)'",
            "Galantis & Hook N Sling - 'Love On Me'",
            "Bakermat - 'Baby'",
            "DNCE - 'Cake By the Ocean'",
            "Oliver! The Musical - 'Food Glorious Food'",
            "Sam Feldt - 'Home Sweet Home (feat. ALMA & Digital Farm Animals)'",
            "Kygo - 'Happy Now (feat. Sandro Cavazza)'",
            "Hannah Grace & Sonny - 'What's Up?'",
            "Astrid S - 'Favorite Part of Me'",
            "Sam Tinnesz - 'Play with Fire (feat. Yacht Money)'",
            "Hidden Citizens - 'Take Over (feat. Ruelle)'",
            "Dylan Fraser - 'The Storm'",
            "Calvin Harris - 'Summer'",
            "Declan J Donovan - 'Anymore'",
            "AURORA - 'Dance on the Moon'",
            "Ruelle - 'I Get to Love You'",
            "7kingZ - 'Survival (Hunt You Down)'",
            "Mimi Webb - 'Reasons'",
            "Star.One - 'Won't Hold Back'",
            "Britney Spears - 'Work Bitch'",
            "Everyone You Know & Joy Anonymous - 'Just for the Times'",
            "Kaylar - 'Only You Could Do (feat. Nala)'",
            "Declan J Donovan - 'Fallen So Young'",
            "Rae Morris - 'Someone Out There'",
            "thisisNAMASTE - 'I Like Your Face'",
            "Snøw, Rxseboy & Jack Cullen - 'Spilled My Coffee'",
            "Zella Day - 'Hypnotic'",
            "Gang Starr - 'Work'",
            "BANKS - 'The Devil'",
            "Laura Greaves (feat. Khwezi & Lhotse) - 'Psychopath'",
            "Ruelle - 'Bad Dream'",
            "Tiësto - 'The Business'",
            "Riton x Nightcrawlers - 'Friday (feat. Mufasa & Hypeman) [Dopamine Re-edit]'",
            "Joel Corey, RAYE & David Guetta - 'BED'",
            "Anne-Marie & Niall Horan - 'Our Song'",
            "Basic Tape - 'Not Afraid'",
            "Pa Salieu (feat. slowthai) - 'Glidin'",
            "Zayde Wolfe - 'Rumble'",
            "P!nk - 'All I Know So Far'",
            "Priya Ragu - 'Good Love 2.0'",
            "Freedo & DJ Katch - 'So Sick'",
            "Red Moon - 'Dreamer'",
            "Olivia Rodrigo - 'enough for you'",
            "Cat Marina - 'Girlfriend'",
            "Winona Oak - 'Winter Rain'",
            "CLiQ - 'Wavey (VIP Mix) (feat. Wiley, Alika & Double S)'",
            "Jodie Harsh - 'My House'",
            "Zayde Wølf - 'Let's Go'",
            "Ed Sheeran - 'Bad Habits'",
            "Dua Lipa - 'Levitating'",
            "Rina Sawayama - 'Lucid'",
            "Hamzaa - 'Sunday Morning'",
            "Georgia & David Jackson - 'Get Me Higher'",
            "One Bit - 'Luv U So'",
            "Glass Animals - 'Heat Waves'",
            "Mimi Webb - 'Good Without'",
            "John Legend - 'Conversations In The Dark'",
            "Zayde Wølf - 'El Capitan'",
            "Deorro ft. Elvis Crespo - 'Bailar'",
            "Dermot Kennedy - 'Heartless (Recorded At Rak Studios)'",
            "PS1 - 'Life Goes On (feat. Alex Hosking)'",
            "Dua Lipa - 'Hotter Than Hell'",
            "James Newman - 'Embers'",
            "Years & Years - 'Starstruck'",
            "Ava Max - 'My Head & My Heart'",
            "Demi Lovato - 'Cool for the Summer'",
            "Lizzo - 'Good As Hell'",
            "Riton & Bad Boy Chiller Crew - 'Come with Me'",
            "ALMA - 'Good Vibes (feat. Tove Styrke)'",
            "Zara Larsson - 'WOW'",
            "KALEO - 'Break My Baby'",
            "Olivia Rodrigo - 'Jealousy, Jealousy'",
            "Mandeville - 'Do It Again'",
            "PEAKS! - 'Blackout'",
            "Cardi B - 'Up'",
            "Little Mix - 'Sweet Melody'",
            "Justin Timberlake - 'Filthy'",
            "HRVY & Matoma - 'Good Vibes'",
            "Jonasu - 'Black Magic'",
            "Alok & Daniel Blume - 'Rapture'",
            "Calvin Harris - 'By Your Side (feat. Tom Grennan)'",
            "Ella Henderson - 'Take Care of You (Acoustic)'",
            "John Gibbons & Franklin - 'Let Me Love You'",
            "Vice - 'Obsession (25/7) (feat. KYLE & Jon Bellion)'",
            "Joel Corry & MNEK - 'Head & Heart'",
            "Wyles & Architechs - 'Body Groove (feat. Crystxl King)'",
            "Lucas & Steve - 'I Want It All'",
            "Pascal Letoubin - 'Feelings Undercover'",
            "The Magician & Wuh Oh - 'LIFE'",
            "NERVO & Carla Monroe - 'Gotta Be You'",
            "Mabel - 'Let Them Know'",
            "Navos - 'Believe Me'",
            "Becky Hill - 'Last Time'",
            "Shane Codd - 'Get Out My Head'",
            "Nathan Dawe x Little Mix - 'No Time for Tears'",
            "Tobtok, Milwin & Alfie Cridland - 'New Levels (feat. Mila Falls)'",
            "Paul Woolford & Amber Mark - 'HEAT'",
            "Jonas Blue & LÉON - 'Hear Me Say'",
            "Cedric Gervais x Franklin - 'Everybody Dance (feat. Nile Rodgers)'",
            "Switch Disco - 'Everything'",
        ],
        ids: [
            "4laAKIq9ZxBCwf99rauPYb",
            "6cx06DFPPHchuUAcTxznu9",
            "7k3uKOLzMCvYM00E3QZTSq",
            "5K6Ssv4Z3zRvxt0P6EKUAP",
            "5iyZwawawLjHYpX4MxUKVF",
            "2lw3naleLuf81Si3tuFVak",
            "1NwQsUKLsOujDGWWMWMMq0",
            "5qaj5FBz1l4Lck3KpK69pK",
            "4S6ytq0m3Wo1kaeRKNw3xy",
            "1vnnXMrBeEWiRg3YCMCjQq",
            "3uMZtPS42ogsVC6MTKTjx7",
            "6lfxq3CG4xtTiEg7opyCyx",
            "0cbBZFEMcIsQujl5dIdcdi",
            "1is8gU4RVcN4J8xItxWoOY",
            "0370DYqDziz7hpwlMBKRx5",
            "3PBOgjs3aYjPtdB1gbMRqM",
            "0WrDaPRMVmJbvds5YeHxKF",
            "58gqyeFXhOttZW3yetJGPN",
            "2AceGjiX9isUbXmMZa0Dl1",
            "6ZTdX1J00zyVlt4ruqOXOL",
            "7L59vVTpoS94JU3KEeolqt",
            "0tV8pOpiNsKqUys0ilUcXz",
            "7nfIMUrJj1Tbryd4sA9ife",
            "5qNYTsP8hNJarzxM7RcE1r",
            "4snOHAw3BxiKWFeOyLeEpB",
            "2sFbdDiEDpyCdP5nUCuGBm",
            "0FS3ljSaj3nU39uzgiXXQH",
            "5nUzRHDvRYqRcOlVWg67Di",
            "1AWKj1JRyQudwBHphlJ4SR",
            "1WCDLO7uelVUDC23u2e8UF",
            "56dOfIe8TCrSvPBnQduue9",
            "7mmeq0ZmRwurYUujKsElqg",
            "3vddOTioaR3lvcqxurNzAe",
            "6YgeMTv3tZcZ87QysSU86X",
            "0F6FsfhxzNhvoMdiNLJ4rD",
            "6uVZdMo4b4bHXgOOd3xJBa",
            "3GqLhinWK0nb0Dcg1iaDmC",
            "5wANPM4fQCJwkGd4rN57mH",
            "5Qsp8mtshe70DX7EYbWZGo",
            "5sdMxVv0feMWN9sOT302kw",
            "6T8DEDkbCQEsnZZrEwQhcY",
            "2GjQ5KNXggsIRpx5ZUj2zX",
            "779rIEdmsgjQ22sYccCU2E",
            "1x05gL9CMLZte5ZizwDGZM",
            "0oagwWkGlBoACUuKvTmqZV",
            "65tCdopbRv73fYFOL40ViN",
            "5YaskwnGDZFDRipaqzbwQx",
            "2NemVm8OFPcHdm4JhTTFTD",
            "1t4NUQuv33szmm8jeLzsZW",
            "2fuiA0FQANMrcr2jXMc0nP",
            "1HxaLGNAfEItbXdQdmXtrw",
            "7sTtHHrD0zDpmzQzH3zegz",
            "3Skzc6bYZur8BWZhfUpAP1",
            "2LKZPa5RetjaX8m9jQ5whH",
            "5dw56JFFfeLtdhLBFLL5pQ",
            "2FymXX7f6OlDskukL6mjYD",
            "4d5g8281I07iaIevSsP1ge",
            "5FgiHNFQZTX1rZIrmYhrPq",
            "4tnAdb6j4VmofALhNg3pAF",
            "50Td3qilgs8BLtv8mHyT1t",
            "1OU4E4HiVjdak0mL4blVWT",
            "2El8x6QIXtKzricbBzbxg4",
            "5z3fn2F5AyFbsjrOyzSnAB",
            "3zHZDl3HldA76rGBedhAJB",
            "4r8lRYnoOGdEi6YyI5OC1o",
            "5FDdviWQzhw7NWH2TiDl9d",
            "0osvOdeD3YXZiWkT8MKolJ",
            "3WMbD1OyfKuwWDWMNbPQ4g",
            "2G2YzndIA6jeWFPBXhUjh5",
            "032DRv0baStN644jRO2lMV",
            "0iN8n2O0Pdj1apImjPlheb",
            "5yv6tEdYkY3EfWXGSMSnWj",
            "3TlIt0ReIxPsVZcOEivT5U",
            "4I5bvu2KDsrCg0EWHIcvul",
            "6U7GUjtamt2P0LcFod1dBT",
            "32OlwWuMpZ6b0aN2RZOeMS",
            "4saklk6nie3yiGePpBwUoc",
            "3mUN3ODbYMtF34rk68aAuX",
            "2nGTt9PIy4KClmla3pZOB5",
            "6WbFefkln0EJiAUkWbqMDL",
            "5rqQv5jUcg58xsi1nuZDl9",
            "3QlTzofanSqDWywxEzGGE2",
            "0Mvntr2gXCFQEqNgk0kjwC",
            "4XknxL5TwlTA8dq3fjDG9E",
            "5o02NFkoJmlKG5rCJTOFKf",
            "2ywXf8Fq7XzsNXwnvytIJ4",
            "76izLl2WtSIPWjVQ2ebnJP",
            "6bI19UEwJvcuxcWjqf8b2O",
            "57DJaoHdeeRrg7MWthNnee",
            "13YIDpKrL2caqJ3YF52uzJ",
            "7aNqYVLpPC0HEGpr3cbYBy",
            "5JCoSi02qi3jJeHdZXMmR8",
            "18lR4BzEs7e3qzc0KVkTpU",
            "5zYiD0qYctWMiLHGAiEcd3",
            "6i2Z0Rj5PLgwODVw7vcH8e",
            "6t0nlLzuahyBab1sYqfOGG",
            "6oJ6le65B3SEqPwMRNXWjY",
            "4FEcEwbE2vsqhxbTPtiNTL",
            "5y0ekFHNfFbjKhZlguSzdf",
            "7DgkSYT6vh3UAYQlFbsj6z",
            "4bhe0XXBRo4EAPKgy4M2xz",
            "3fPWU0gzWrmLSSRfObRX7m",
            "0eMtK0mVNQZtHKXYH2axiS",
            "5t9KYe0Fhd5cW6UYT4qP8f",
            "6Dy1jexKYriXAVG6evyUTJ",
            "3I8rRolUKTTFnqQ0EXFMtv",
            "0939D7aT18uBDS2MTjWzct",
            "0k664IuFwVP557Gnx7RhIl",
            "5e2mTXl07l0PiRzXdsWKlt",
            "6jRwkbiqOfkNGty2fGTXzd",
            "4wcafy2RG5BThOCoZhgecb",
            "4keoy2fqgwGnbWlm3ZVZFa",
            "72vWmeqYcT1irKClpbenQm",
            "4IKa5EKTmhKvV1wuTJf9Eq",
            "5Hyr47BBGpvOfcykSCcaw9",
            "3iw6V4LH7yPj1ESORX9RIN",
            "79qPDRmHmJ5xcU7oyS8CQ1",
            "7MAibcTli4IisCtbHKrGMh",
            "3tgZ9vmhuAY9wEoNUJskzV",
            "1rfofaqEpACxVEHIZBJe6W",
            "0puf9yIluy9W0vpMEUoAnN",
            "4QVFtAswXqPoAWRLo5yu8a",
            "7b7WSNukZ19L7VtmspH0um",
            "5HCyWlXZPP0y6Gqq8TgA20",
            "1uH3ACslv1CZCCAqyPtG3H",
            "4wH4dJgrsxONID6KS2tDQM",
            "5ulwRzYWlL07rhhfsF6seo",
            "26wHWnTGvX1ZJTlttMyht0",
            "0cvMWzztDy1wNQkBqae8w4",
            "2LhA68Vm5k6lh0QenNFrDV",
            "2bgTY4UwhfBYhGT4HUYStN",
            "1DrNhBfQ2QPYfp4zeIWmy4",
            "2vlgOAH3M8Fmo19wOjeRyw",
            "6IKoE1DlvzdGfzUS9QQaVP",
            "4IV4SFhWZu3kruNHY2aQvB",
            "2tW9lXMLknjIKFmWtMpf54",
            "5B8QxD27ZPvm0r7ymlyjNx",
            "1mMvahhW2Oz9waG8UTQnI4",
            "4QOfUrTWpIlmziECELlCYN",
            "3F8rJGvtlwr93lKQjEky2K",
            "4bsEnd5wrxji7RVL4QiRlQ",
            "2XgRGKZqta5TAAqt9jgxwX",
            "2nRUIcZpDxkTeP7Z6zDMqO",
            "71Taskl2O73XfpQtJciJCD",
            "5YvcUK2eXJ2OllqDuEg18S",
            "46r2Q26GCwV7LgfHYZIH2i",
            "6oQV4xYifCFSWvT7a8l6we",
            "6eCmK3GQyFuTNWCJHsaF9d",
            "3dPQuX8Gs42Y7b454ybpMR",
            "61jujLgiKTKb766k50QNQy",
            "2EZ2KXLqs9zdRVVMMz1IsH",
            "3vFpg5JkqEi5lrqod4KC4N",
            "2hCRYTXZ2MGazezjSQjIWE",
            "45nYizfvlcjhIPLnXGP4ls",
            "27u7t9d7ZQoyjsCROHuZJ3",
            "2Vnw8zKmjhr1jczUeaqiQg",
            "5zHRrkIk98Adfqh25kMZFU",
            "7zBIUPqenD2CE5iJhvt2ew",
            "0ygOBx60exSPPvnI4sS28r",
            "4tmJrNTWwPE4rk4qZd1ONu",
            "2nrlwLgq4ufLCFyX3PpnEc",
            "4GtsU8mY7yrjwOb0QkCJ6i",
            "7xQYVjs4wZNdCwO0EeAWMC",
            "4O5FYdgaSg5QxcUnSBeO3P",
            "3tZ5QMzDQkEb91JVCYbw8M",
            "73aLVyylsbVVI0pIwp6daP",
            "5OX1xKPOtjgmMATih9t1uR",
            "3Oip6Z2wUW45sYMI5XXjLW",
            "6FwvvtAuHIvdeupkTpaTRN",
            "7hPYYE1RCIJovbGrP0fAG6",
            "5pK2Weaju6uAFYeqRSoNXG",
            "1mhC2Jcg7kF4GNZV0Rv7oF",
            "7LqUwzOSDAdQp111VQG9Mk",
            "39x8osSFRUQarEgkYwyJsT",
            "7k3uKOLzMCvYM00E3QZTSq",
            "2okt1sEb4uh6OkLJ4cgMWx",
            "1Xi84slp6FryDSCbzq4UCD",
            "7hDVYcQq6MxkdJGweuCtl9",
            "4CTJbiUAJvHji7dEGU1Hv8",
            "2WqTeBwSH6buPazP3GNFjY",
            "6wR3zbFumY6hfNgN6xtrBI",
            "2rLO0WXRwcxJJRYLHzRJpz",
            "0v8OKUrqZGoEbgEUXScRSQ",
            "3TAGAAWQ9HeosMtv4dz2jf",
            "4jfhcGj0J6JxbBHShf8ExT",
            "0Dc3ekzrL3SQqTiqYkRDvc",
            "7edN1zsBhEfrO2OJhhIPw4",
            "424m0YnbIl5oLOS2SQiIXi",
            "2aUYt0CwHeJLrlgi0akUGp",
            "1kUuIStjbCOKFX2S0ZoBJM",
            "68EMU2RD1ECNeOeJ5qAXCV",
            "38GBNKZUhfBkk3oNlWzRYd",
            "2WyRfGeHo97VC5mP1BBSzr",
            "6ce17pZwsMcYNab5IaC5MQ",
            "4jKeYH0Gwq2PE3YYSClzM9",
            "10PSkNnZbDnS25UQcqTZkk",
            "3I6WUxyaO5rxn1or1aiIl7",
            "4QlYULG9SEgFLmM7SHA1SZ",
            "2exUyljlhoH86MlcicuUXd",
            "2J4dIxFmUpRGTOAeJimcRa",
            "3SVnZqxXe3V4mhm07fs3xC",
            "2IyaM5b7E2pXwLKtiqCU9F",
            "66TRwr5uJwPt15mfFkzhbi",
            "2WaYW84yWij5NSCpgSeU2R",
            "0RJjjrNRF1xxhy7ZDXZgW6",
            "620U5OI7w9lDastFdqhsy3",
            "1O8AGZodcHcRjjnS0RnemV",
            "5DF2KFDVeC7wF5CXipl9WN",
            "4JlRXVckYnpG3BZqqH9vFA",
            "7CUPfpfuPwjicclWi4qKH4",
            "0d5f6gzzW1Pgx9uJsLrSDP",
            "2u6Jm2klS4yvAlbSHlxUwI",
            "5CSKbHjpqborGnlzagyaDo",
            "4WkpLzIQR8JCWnMpAj7Cn0",
            "7lf3OEr1I0wjFlbn8wCnYK",
            "3iAaoyf1H1ewy2Srrg1Vgo",
            "34daMG0AI8vK5pQV5o60cJ",
            "0rwTYerBtc7DC80aVOx71t",
            "3VZANhIzH5vYaOXuqlYnNa",
            "43MZ2K6xe4fvg93C95Fays",
            "7FRICngbPiyTPEKF7wRC9G",
            "3IA89ROOb6QcQxFkviEs4e",
            "3gwJhiaCPcdLgPePwxPd1S",
            "02WEU96VRKntV0pw9uMhv6",
            "7eQHxigpuDJjCG50JyzU8v",
            "4CUyNgMxAFKFEf1KrbAEbY",
            "1c4K1abYxN8mP29VeB47ic",
            "2lw3naleLuf81Si3tuFVak",
            "6ImEBuxsbuTowuHmg3Z2FO",
            "5WHTFyqSii0lmT9R21abT8",
            "3MYCQktaoMWhtaP2Uq7mhn",
            "6Q3K9gVUZRMZqZKrXovbM2",
            "1nuDf5WpelCulE091ZK8nT",
            "2kMAKtrAu16HVWxBnOwuhd",
            "1u3wTtKBqcmmqN9zjZq5Py",
            "0FeMcfh8VQJGqwxA43wDfV",
            "0HL5XOeVxgX1cEPY2KgRRa",
            "5WHgAhE3VlGpBiNKUWEyDY",
            "6AynlgSKxWXPaTQUawcUrP",
            "6QkjBOwIRoRPDOQNULWgiC",
            "5gQCUf4lfy6GpuhdPzxQ6B",
            "5dYs9IhYDPUqlYKILmRXt5",
            "5CZ40GBx1sQ9agT82CLQCT",
            "26IJjT0ES0eWkvlerd9iv8",
            "4sf2A9RLcE5QbkvOC6HlW4",
            "7dxIIBzzdvtfp5d1ICYfWU",
            "3IaYO1eZy0lamtBfsQ0v1n",
            "2zPWT2axxNsXMU6CZn3PS5",
            "1f7849PlqyhbRRuHeGwuQV",
            "3NgCzSW98SsqBdpYcnm4kv",
            "68GFPHr5LtadnQ8wOtramJ",
            "1j6lrR4BzRGKwvAPfrIcbf",
            "305WCRhhS10XUcH6AEwZk6",
            "6lx41mPrde3vkcb8qUQOOi",
            "6e7Eudq88wcygOphhtQnrN",
            "2jC1ohpqxPQLXRmAJue589",
            "6jBXavyuyjaCcxSS9eQJf5",
            "5gjATWO1EIhrCP1CQ2GWg8",
            "1686F2196HNZ6nk8kB2tsF",
            "4XeB4GsU4QPjAHVtEmxTJ6",
            "1RWVboREJYb3N6bECjID7d",
            "53bCcVMGv0S2aIYvfju2Tt",
            "0zn5Sa8fRjpUo7XXUaNRTB",
            "76YZQfiicR9XxvobjgJsEQ",
            "3kswR4VNp2z8f8VXUHfTSD",
            "3cixuToHeVkcYiPSPfUbqX",
            "4rs6qdQmpmUA4egHwzCUGi",
            "7ju6ZuPKV1briUSmCCFOcf",
            "51GwyUVbV0i0vt8v3pAaBT",
            "7HVmwjRRWYH40tm9EG1sQb",
            "4qu63nuBpdn0qHUHuObEj1",
            "76fJ8AFl4mMcBcvpMnTrEK",
            "4soRSjciciKPQaR2ER6AXQ",
            "3JWVQRuJPPOVLdbn61bXEM",
            "5ow0sNF1zSqp71Ix5jEXWU",
            "3fZpuY6pfjBeMsrnKMtbXQ",
            "73h6Ma5QhBFrshEN2CTevS",
            "6SRsiMl7w1USE4mFqrOhHC",
            "4btfzhaFLkVJAQZMgofLnU",
            "6nBb8IIHGuGGjGJ4rKuai5",
            "50v2TSRV31bwpAPkjWejNL",
            "6wyEDSR15zW3JrJyirj22r",
            "6LkIe2jYyUiFvSFY3jYPc4",
            "3TfVzmeOSoZei5SMnYWfg9",
            "6PxXA3bO8ktyaLHUHx1QQ4",
            "3iw6V4LH7yPj1ESORX9RIN",
            "0EdgK7ASb4kfRkW8pVMN02",
            "5FQUb9sBnjA2Cd0lujJ3hr",
            "04oTyEbJ190RfXWSlTP4b7",
            "7bIq1v8svANsAys7I694Up",
            "1MGqtRnKlHNO4fuHMm2Dm9",
            "0ieEZjHQO5eq9Uad7opItK",
            "0W501uGBeWUccOFNruqeDA",
            "6xsy104fRTcGeSKUdcsafZ",
            "30rvG8w7qtOnsqiUk6JSvE",
            "61qtnvPp4GwaoxhE1wBARP",
            "5xNpsWUHMrBvWNiQc3HAiK",
            "3GLJRdWd5VSCGbPzQG6Wxc",
            "4YMApzzqCO31TPxPvgdHhh",
            "3M89zvwwb1jtDUDKYNsdiA",
            "5PVswXfsT9bWxhDQMcPoGr",
            "62xA7Zhj8CQSecypWIfpZx",
            "0uqFo6F9DppKZtwm3zhG3s",
            "0DmAvNCAK08oCi7miSZUIY",
            "3vRN8ZmmbU5dROagXs8WnP",
            "13o2JDdazKogpXF6027LwT",
            "4hE1MYezWgJNIyOSbLGlvJ",
            "3u2MsB1EW8RVUMiw5EV8ll",
            "1xie2yGTobnINjAr1F0Jua",
            "4T3eFLTLDMH94NQOGSuL8H",
            "2Y9oTMNY5CPT4m9l6CgbgM",
            "4FdlrVG63Nsx9I7dBtsh6J",
            "4iWKQu7GcqRl1aVll2PD20",
            "4jsVYaFtVucMtaWuT4Ht9o",
            "7xl2ZaOnKAxJyrkIQe2S43",
            "2prKoGU8V8oZ5LJQD1tddB",
            "13WrQpPeut2MTy6jbRwc2Y",
            "58f9nTeQ3ORN2nvtWYbnON",
            "1MfySlDz4KVR2re96y4WF7",
            "5Cbc3v4DKzrwQAv3hlA9Hn",
            "4wcBRRpIfesgcyUtis7PEg",
            "1aKz5AuZn1mXb2BVCnbM72",
            "3rJ8RRWF3sJ5Bg4muMEMaC",
            "5UMJYhj9cdiJMyekGGnHX3",
            "65cQkOFngSgj37Gnzp4ry4",
            "3YRFxtNz0CCiBYmZO0rPdr",
            "2UFnAnx5ZC0RgCqVSlA1Zj",
            "5kHbqHEHR2HEI70wruSAaq",
            "1xaOhiFM7q5Yi2H1v5WUS2",
            "2kU6bMVN21UbJ425q1yIKR",
            "6BwkRSZoAjsCQOWgbH3oAs",
            "1a1SQeSqUKzH5OUVTEx4ae",
            "4QsJS5zR9PNs6sYftMgltU",
            "69El8bwwxvL6MKfDCwdRHR",
            "4Pm1IMlPkjtZpvSBVFW6ml",
            "4LbezHX4BdUnmogPcxiQCw",
            "7wmlnViL3beMYzzIo29cjU",
            "0b18g3G5spr4ZCkz7Y6Q0Q",
            "2sX7lJXsOYGP1Us6CqM9t1",
            "7HawJ9lK15vOwQLqMu0apL",
            "5ckotmS2CJaxN3Uro1j8cX",
            "37BZB0z9T8Xu7U3e65qxFy",
            "1qDrWA6lyx8cLECdZE7TV7",
            "4191RXFPa7Ge9XkA4cWlna",
            "3xxoo1LSoSajewrSdNdfdo",
            "4hkSiyO1zy1scfc4HWMGR4",
            "0GWYApQBwErVPkyXYCTJjI",
            "1NkwZ9TnIs8js6G0M6M7RU",
            "3Be7CLdHZpyzsVijme39cW",
            "7a53HqqArd4b9NF4XAmlbI",
            "4tmIJTSnuvskqsPwB5RCqx",
            "1OfHes9WQdGQSIgNwrqIAw",
            "5zEAGm4yKQ8NMemN0m3rW1",
            "5o459PfDdkvptrq8lAGerD",
            "4NTAmq5vf3cXuKZIDV94w1",
            "1EB8LB1Hu5T4C8Zk9z1Ckh",
            "6i2Z0Rj5PLgwODVw7vcH8e",
            "1bmvJkAA8Yz9bv6y3WOj3U",
            "0LgdaGPWHNwruohfYxc7Z6",
            "114y6mYBzuec5xUBUZ56lg",
            "378Z7yJIoFxNOD15jdkWeo",
            "55BKv7jjl2JKL85vbBRnIS",
            "61ZM92T2zaXIVsqncThQzC",
            "3AkdSFo7quCZ781KCqNK0T",
            "43zdsphuZLzwA9k4DJhU0I",
            "1yAPglN5AGf7UoLK062ZYq",
            "1btdem1ldi7j2vyUqNVa2h",
            "2Wc2tcQl7cPetPKeXH3GD3",
            "3IhqzdVtFVS3xiyZuNAgMD",
            "2Ms8MDDtYBw7M3K5F3EqPX",
            "29YZUO8mTfFvROG6XHOBkx",
            "1kWUMpe0w9h4ep1iCvPflp",
            "6sKojK1kiRDBv0NHqw7f0S",
            "25EFV32bdkJ1K9cuODEZmp",
            "0WXFAweDUMSLl2YZl8NSTc",
            "0mA7zotmg2ZFMRALljdZsS",
            "7lYiZOy2syi7UwS2XEpmeM",
            "2d0fYbjddMGhBumE4hNpAw",
            "4kG6Rt94q7eJaikOFrqsTn",
            "6Lun7r4QvYI7AZ3aKCOuhQ",
            "4FEcEwbE2vsqhxbTPtiNTL",
            "0KMrYUEfexgam36li6d9F0",
            "5u1n1kITHCxxp8twBcZxWy",
            "2g2a5kDeZexbUTD8abcvm6",
            "5Ih3Sl6HXfjv3s4gcr7pDH",
            "4R4gOp9ybG85RqbrY7JELc",
            "2dh6Pnl5egc1FrQS6EsW4n",
            "7DMbkEORs1vmAevc4TD8KC",
            "29CDTN3TfjGr4f1yRQqAtV",
            "4I5bvu2KDsrCg0EWHIcvul",
            "1kKPRIlPOXmaAMlYxY8sSS",
            "5JwaKuFciGErKq01IHfC9u",
            "4v8jmsVox8VwU5js3JHOJZ",
            "5xYC48nOppVemY6U5GRGTb",
            "22HYEJveCvykVDHDiEEmjZ",
            "6WrI0LAC5M1Rw2MnX2ZvEg",
            "6MnWfOgKRkQtY1pRgoTwB1",
            "1lr5prHQn7Q766Ix6eGRKK",
            "305WCRhhS10XUcH6AEwZk6",
            "6LRhfKP8E7q0XEufBUgc2R",
            "3LXMjmBQYwe48U0MR1IOMI",
            "4P6g8wuXeR3wznFk7WnI4w",
            "2Kxui5Em4lw9WwbH2qXDlY",
            "1aOkr7wJMtUYkv0mE3hz2N",
            "2zEh9FgszAX9ms1rdOeDX0",
            "2XDxQ3VzovLzh60zgOaNEi",
            "11LmqTE2naFULdEP94AUBa",
            "0FNLnZRNWEIbGsb8jkU2lv",
            "7k3oIRG0qWZzR9hn8UzcIx",
            "3Anl6288XYbaW2D6L8Yl5S",
            "3KwVYKnUKWo3zyLZ7LOZjy",
            "5Q0bw2MFy1pRHJXZgssBtz",
            "5wRqbS5LWr06yeCy5laI5p",
            "5fkbOmiHN3RnG1qjzNFMyi",
            "6E3yU2m8I2AYxc84Xk4C5Q",
            "5ri4zqtWhG07hIuNNDWP76",
            "3MYCQktaoMWhtaP2Uq7mhn",
            "6lhZLbb0czULpjb2kFryPS",
            "40F3wVLBSeysQlIfxmo3pG",
            "752noY44yVo7eYK78VikAx",
            "0FiaroF4hBSeBpUXoxHUMl",
            "7xbWAw3LMgRMn4omR5yVn3",
            "5CGpPUcUahMuLzkNK9ZgPP",
            "4VPlKUSjC9HdZdUbFZ0Y5y",
            "5NeFmsnXBy6xVbz8pesM5l",
            "2MHCiOohBZEQuLgDTPvSzF",
            "1bA2ZK7CFxEMnyn1dWP2jp",
            "76hfruVvmfQbw0eYn1nmeC",
            "7pHqRkNR5UUQpHnRETogUq",
            "3vIPdMmbsye0YMhXy4GeXt",
            "14sOS5L36385FJ3OL8hew4",
            "0uvoH3WKfIUc1fOxPkRY2R",
            "0cppqb4vQycORHNMxr8DGd",
            "7vguMCv8uVuZLiQJ156u3Z",
            "5q9x2ptXwszcrJOffQyi3Q",
            "395XJ62VlU0GSpinn3Fe3O",
            "6YUTL4dYpB9xZO5qExPf05",
            "0pr84OeGz38GCYWUD9Z0Xq",
            "6Q3V53lccKlnlMpBUCD5X1",
            "3CV4lFELdziNM1OnHU8nwz",
            "1kNPZgBNDNoz0CanZYBmc0",
            "4kPV7Tx30Ph0tQ4XrhgYCh",
            "3kmwh4EFTMTuDYlVkvm4MB",
            "3KliPMvk1EvFZu9cvkj8p1",
            "67LyilCFvsLvoC7zEBPcKK",
            "3lXSsYd2yaFL3ecyd1FZP3",
            "3y4uSQwxHckyRcvafEilkN",
            "3Hn9rn1OmKT8HKELGBTztL",
            "44WnSwG225CA0RI0DTGggC",
            "6k9JEQKIHCKjgrOVxdLMaW",
            "2zsWRxMcUdGjj8TnWkVKw0",
            "1EiLrPd8JMTcQUr1aLEUKi",
            "5dpvKFUEjSRgSgvPUkNgDL",
            "5rLURQxuGdD2E8sgPg5a7i",
            "1XO1QUeaqLjEtoA2zcHz9m",
            "6f3Slt0GbA2bPZlz0aIFXN",
            "2Xwc9YMiXXKiiE4DJigYP4",
            "0siYMEsGrzzzlWLXK5zJfS",
            "5zqObw7wjBgL9TDiAymxPn",
            "7HQr8s8z9Fsj6WwFrAOSn3",
            "5zOqYPTcgiTAZfnKUbaNSf",
            "2WxgpAT3sZQ5xzkAJL1HsC",
            "4LmN3eU1R1vVEdKuDELpGk",
            "0xErrzRegFIsekcvQ5wsS0",
            "6ee7GQEkmWld8pGIl0E19Z",
            "0Ne1ziL4Uj6OD12sDG5wru",
            "2TOzTqQXNmR2zDJXihjZ2e",
            "6Bjo1ZWNZNQHBCfQdzvfDV",
            "13PrnJqkkjRXXH6IExfR0W",
            "5KvRFKrsapVHYNzoM7rDUw",
            "2nIaXCaDBXXALg3gKajbLB",
            "7qMh0clJqIbOqacl6w0TNX",
            "6PQ88X9TkUIAUIZJHW2upE",
            "463CkQjx2Zk1yXoBuierM9",
            "5DVATjQZPVsm5kWbrPmekU",
            "0CxVnKu6PG6tYTGVtSD8UU",
            "2fC5ogeB9BsRLQHOQ0u9WC",
            "3iDLKicE1nUXsNf5rZkY9p",
            "02MWAaffLxlfxAUY7c5dvx",
            "15OCqNPYoLziEAsbVnqRj5",
            "20d27F17AZOxTJOEHAVK2Y",
            "0BSoBer7jdwq4NsIwPL4Y1",
            "1A5yplwEk6cJbAL63L6bkp",
            "6S4vdF9ENvX8WN8PvJ6soA",
            "4toYTJxK1Q7uNkzeFzKJuu",
            "4fTlLuSt6R3OnjAj0Ty5OC",
            "5Dmq7XPXXcATuJnSOj8UrT",
            "2WJVFqVQ3ivhAoAQWzEzeL",
            "1KixkQVDUHggZMU9dUobgm",
            "3uwnnTQcHM1rDqSfA4gQNz",
            "6KgBpzTuTRPebChN0VTyzV",
            "2Iz6IShd0yHxPMkWXjLntB",
            "6QZI1RKiuU6PfHdr7wnvTk",
            "5WokFKscrfGEGGLPTu3jgO",
            "5NnFkbEjahUGx5T3qxbNCW",
            "0MMyJUC3WNnFS1lit5pTjk",
            "340cWLd1a1rO1u4NKuIPb0",
            "5YWwn67BUDjiDODELhOOSy",
            "1XXimziG1uhM0eDNCZCrUl",
            "76Tuo484SLohJakHLnGI3B",
            "5ZpjODX6OH1xZs3AOewTO6",
            "53kWAAfx7IopXRa31MQHB8",
            "7zx1i0jGcFwMBurajgKlO7",
            "0CNxWAkG4ysu9Z3eCfknWK",
            "0vR2rIVORmgeKiGIgNT0fV",
            "7GajHE5z66qqmzTrKVFCab",
            "5kgeY10kFAXvA3l6xuOEhE",
            "5pvVAwQbuFoR7LkcicrKnk",
            "6cx06DFPPHchuUAcTxznu9",
            "2sW3snLTi77h0rm4g9tDuD",
            "3oSCJeOl0XjcpNcigO9vj7",
            "1zgGdPiM1kiouVwU3wpgQK",
            "2OOb0wDmLyyhC2ViXembbS",
            "2Q8fFORnsDE6I3RNvSLXSf",
            "2lw3naleLuf81Si3tuFVak",
            "44xO8889yUQHn70P73NILS",
            "54zJ1SxDe0CQhWRij7E0no",
            "055Mme9ReKK99jRFA5UJ55",
            "2Rr1INov0ckj7bLTsk9LV1",
            "59RehGuw90cshXlt5mPWI9",
            "4x0yfBUpGWpovUxJqj20p0",
            "7dk9EBvTbbKBbFxjCAJpwK",
            "2KP2670rcQA5XRZyQcVhDK",
            "4S6ytq0m3Wo1kaeRKNw3xy",
        ],
    };

    const app = new App({
        target: document.body,
        props: {
            auth: { clientId: "5dfa309106f847819f19d5af2dd774cb" },
            data: {
                names: data.names.map(n => {
                    let [artist, song] = n.split(" - ");
                    song = song
                        .slice(1, -1)
                        .replace(/\(.*?\)/g, "")
                        .replace(/Extended.*/g, "");
                    artist = artist
                        .replace(/\(.*?\)/g, "")
                        .replace(/&.*/g, "")
                        .replace(/,.*/g, "")
                        .replace(/ft.*/g, "");
                    return { song, artist };
                }),
                ids: data.ids,
            },
        },
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

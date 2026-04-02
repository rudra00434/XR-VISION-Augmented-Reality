/**
 * AERO-G1 · Hybrid XR Vision System
 * main.js · v4.4.0 · Premium Stable Engine
 */

'use strict';

const state = {
    diagnosticActive: false,
    helmetPlaced: false,
    cameraActive: false,
    cameraStream: null,
    loaderHidden: false,
    currentMode: null,
    manualPlacementHandler: null,
    version: "4.7.0"
};

const $ = id => document.getElementById(id);

/* ─────────────────────────────────────────────────────────────
   CAMERA MANAGER (Pseudo-AR Fallback)
───────────────────────────────────────────────────────────── */
const CameraManager = (() => {
    let _videoEl = null;

    function _buildDOM() {
        if (!$('cam-bg')) {
            _videoEl = document.createElement('video');
            _videoEl.id = 'cam-bg';
            _videoEl.setAttribute('autoplay', '');
            _videoEl.setAttribute('playsinline', '');
            _videoEl.setAttribute('muted', '');
            document.body.insertBefore(_videoEl, document.body.firstChild);
        } else { _videoEl = $('cam-bg'); }
    }

    return {
        async request() {
            _buildDOM();
            return this.start();
        },
        async start() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                state.cameraStream = stream;
                state.cameraActive = true;
                if (_videoEl) {
                    _videoEl.srcObject = stream;
                    _videoEl.classList.add('cam-visible');
                }
                document.body.classList.add('cam-active');
                _setSceneAlpha(true);
                return true;
            } catch (e) {
                console.error('[Camera] Access denied:', e);
                InterfaceManager.showToast('CAMERA ACCESS DENIED');
                return false;
            }
        },
        stop() {
            if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
            state.cameraStream = null;
            state.cameraActive = false;
            if (_videoEl) _videoEl.classList.remove('cam-visible');
            document.body.classList.remove('cam-active');
            _setSceneAlpha(false);
        }
    };
})();

/* ─────────────────────────────────────────────────────────────
   INTERFACE MANAGER (Hybrid Dual-Mode)
───────────────────────────────────────────────────────────── */
window.InterfaceManager = (() => {
    return {
        async launch(mode) {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');
            const modeLabel = $('xr-mode-label');
            const helmet = $('helmet');
            const productRoot = $('product-root');

            if (!xrScene || !helmet || !productRoot) return;

            // 1. UI Preparation (GSAP)
            if (hero) {
                gsap.to(hero, { opacity: 0, y: -20, duration: 0.6, ease: "power4.in", onComplete: () => hero.style.display = 'none' });
            }

            xrScene.style.display = 'block';
            xrControls.style.display = 'flex';
            gsap.fromTo([xrScene, xrControls], { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.3, ease: "power2.out" });

            const isAR = mode === 'ar';
            state.currentMode = mode;
            state.helmetPlaced = false;
            this._teardownManualPlacement();
            this.stopRotation();
            this._resetProductModel(mode);

            if (modeLabel) modeLabel.textContent = isAR ? 'MODE: AUGMENTED REALITY' : 'MODE: VIRTUAL GALLERY';

            _setSceneAlpha(isAR);
            this.startTelemetry();

            // 2. Initial Model State
            if (!isAR) {
                productRoot.setAttribute('visible', 'true');
                gsap.fromTo(productRoot.object3D.position, { y: 2, z: -3 }, { y: 1.2, z: -1.8, duration: 2, ease: "elastic.out(1, 0.75)" });
                this.startRotation();
            }

            // 3. Request Session
            if (navigator.xr && isAR) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) {
                        this.showToast('SCAN THE FLOOR, THEN TAP TO PLACE');
                        await xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native AR check failed:', e); }
            }

            if (navigator.xr && mode === 'vr') {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        await xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native VR check failed:', e); }
            }

            // 4. Fallback (Pseudo-AR)
            if (isAR) {
                this.showToast('NATIVE AR UNAVAILABLE · USING CAMERA FALLBACK');
                const cameraReady = await CameraManager.request();
                if (cameraReady) {
                    this.showToast('SCAN AND CLICK TO PLACE HELMET');
                    this._initManualPlacement();
                }
                return;
            }

            this.showToast('DESKTOP GALLERY ACTIVE');
        },

        exit() {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');

            if (!xrScene) return;

            state.currentMode = null;
            state.helmetPlaced = false;
            this._teardownManualPlacement();
            gsap.to([xrScene, xrControls], {
                opacity: 0, duration: 0.5, ease: "power2.in",
                onComplete: () => {
                    xrScene.style.display = 'none';
                    xrControls.style.display = 'none';
                    if (hero) {
                        hero.style.display = 'flex';
                        gsap.fromTo(hero, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: "back.out(1.7)" });
                    }
                }
            });

            if (state.cameraActive) CameraManager.stop();
            _setSceneAlpha(false);
            if (xrScene.is && xrScene.is('vr-mode') && xrScene.exitVR) xrScene.exitVR();

            this.stopTelemetry();
            this.stopRotation();
            this._resetProductModel();
            window.dispatchEvent(new Event('resize'));
        },

        _initManualPlacement() {
            const xrScene = $('xr-scene');
            const productRoot = $('product-root');

            if (!xrScene || !productRoot) return;
            this._teardownManualPlacement();

            const onSceneClick = () => {
                if (!state.cameraActive) return;
                state.helmetPlaced = true;
                productRoot.setAttribute('visible', 'true');
                productRoot.setAttribute('position', '0 1.2 -1.5');
                productRoot.object3D.scale.set(1, 1, 1);

                gsap.from(productRoot.object3D.scale, { x: 0, y: 0, z: 0, duration: 1, ease: "back.out(1.7)" });
                this.showSyncGlow();
                this.showToast('DEVICE SYNCED · OBJECT PROJECTED');
                this.startRotation();

                console.log("[XR] Helmet Rendered at Focus: (0 1.2 -1.5)");
                this._teardownManualPlacement();
            };

            state.manualPlacementHandler = onSceneClick;
            xrScene.addEventListener('click', onSceneClick);
        },

        _teardownManualPlacement() {
            const xrScene = $('xr-scene');

            if (xrScene && state.manualPlacementHandler) {
                xrScene.removeEventListener('click', state.manualPlacementHandler);
            }

            state.manualPlacementHandler = null;
        },

        _resetProductModel(mode = null) {
            const productRoot = $('product-root');
            const helmet = $('helmet');

            if (!productRoot || !helmet) return;

            gsap.killTweensOf(productRoot.object3D.position);
            gsap.killTweensOf(productRoot.object3D.scale);
            gsap.killTweensOf(helmet.object3D.rotation);

            productRoot.object3D.position.set(0, 1.2, -1.8);
            productRoot.object3D.rotation.set(0, 0, 0);
            productRoot.object3D.scale.set(1, 1, 1);
            productRoot.setAttribute('position', '0 1.2 -1.8');
            productRoot.setAttribute('visible', String(mode === 'vr'));

            helmet.object3D.position.set(0, 0, 0);
            helmet.object3D.rotation.set(0, 0, 0);
            helmet.object3D.scale.set(0.9, 0.9, 0.9);
            helmet.setAttribute('position', '0 0 0');
            helmet.setAttribute('scale', '0.9 0.9 0.9');
            helmet.setAttribute('visible', 'true');
        },

        _bindXRSceneEvents() {
            const xrScene = $('xr-scene');

            if (!xrScene || xrScene.dataset.xrEventsBound === 'true') return;
            xrScene.dataset.xrEventsBound = 'true';

            xrScene.addEventListener('ar-hit-test-achieved', () => {
                if (state.currentMode === 'ar' && !state.cameraActive && !state.helmetPlaced) {
                    this.showToast('TAP TO PLACE HELMET');
                }
            });

            xrScene.addEventListener('ar-hit-test-select', () => {
                if (state.currentMode !== 'ar' || state.cameraActive || state.helmetPlaced) return;

                state.helmetPlaced = true;
                this.showSyncGlow();
                this.showToast('DEVICE SYNCED · OBJECT PROJECTED');
                this.startRotation();
            });
        },

        showSyncGlow() {
            const helmet = $('helmet');
            if (!helmet || !helmet.object3D) return;
            helmet.object3D.traverse(node => {
                if (node.isMesh && node.material && node.material.emissive) {
                    node.material.emissive.setHex(0x00dcff);
                    gsap.fromTo(node.material, { emissiveIntensity: 0 }, { emissiveIntensity: 2.5, duration: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" });
                }
            });
        },

        startRotation() {
            const helmet = $('helmet');
            if (helmet) {
                gsap.killTweensOf(helmet.object3D.rotation);
                gsap.to(helmet.object3D.rotation, { y: Math.PI * 2, duration: 20, repeat: -1, ease: "none" });
            }
        },

        stopRotation() {
            const helmet = $('helmet');
            if (helmet) gsap.killTweensOf(helmet.object3D.rotation);
        },

        startTelemetry() {
            const track = $('ticker-inner');
            if (!track) return;
            const items = ['CORE TEMP: 32°C [STABLE]', 'XR LATENCY: 1.8 MS', 'SIGNAL: 100% [ENCRYPTED]', 'SENSORS: ACTIVE [6DOF]'];
            track.innerHTML = items.map(t => `<span class="ticker-item">${t}</span>`).join('');
            document.body.classList.add('ticker-active');
            gsap.from('.ticker', { y: 40, opacity: 0, duration: 0.8, ease: "power4.out" });
        },

        stopTelemetry() {
            document.body.classList.remove('ticker-active');
        },

        showToast(msg) {
            let toast = $('xr-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'xr-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = msg;
            toast.classList.add('visible');
            setTimeout(() => toast.classList.remove('visible'), 5000);
        },

        hideLoader() {
            if (state.loaderHidden) return;
            state.loaderHidden = true;
            const loader = $('loader');
            if (loader) {
                gsap.to(loader, { 
                    opacity: 0, 
                    duration: 1.2, 
                    ease: "power2.inOut",
                    onComplete: () => {
                        loader.style.display = 'none';
                        loader.classList.add('hidden');
                    }
                });
            }
        }
    };
})();

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function _setSceneAlpha(on) {
    const xrScene = $('xr-scene');
    const env = $('environment');
    const lights = $('scene-lights');
    if (!xrScene) return;

    if (on) document.body.classList.add('cam-active');
    else document.body.classList.remove('cam-active');

    if (env) {
        env.setAttribute('visible', String(!on));
        env.setAttribute('environment', `active: ${!on}`);
    }

    if (lights) lights.setAttribute('visible', 'true');

    const canvas = xrScene.querySelector('canvas');
    if (canvas) {
        canvas.style.backgroundColor = on ? 'transparent' : '#03030a';
        canvas.style.setProperty('background', on ? 'transparent' : '#03030a', 'important');
    }
}

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Scene logic
    if ($('launch-ar')) $('launch-ar').onclick = () => window.InterfaceManager.launch('ar');
    if ($('launch-vr')) $('launch-vr').onclick = () => window.InterfaceManager.launch('vr');
    if ($('exit-xr')) $('exit-xr').onclick = () => window.InterfaceManager.exit();
    
    if ($('toggle-diagnostic')) {
        $('toggle-diagnostic').onclick = () => {
            state.diagnosticActive = !state.diagnosticActive;
            $('toggle-diagnostic').classList.toggle('active', state.diagnosticActive);
            InterfaceManager.showToast('DIAGNOSTIC MODE: ' + (state.diagnosticActive ? 'ON' : 'OFF'));
        };
    }

    window.InterfaceManager._bindXRSceneEvents();

    window.addEventListener('message', event => {
        if (event.data && event.data.type === 'preview-ready') {
            setTimeout(() => window.InterfaceManager.hideLoader(), 500);
        }
    });

    // Safety fallback: Hide loader after a timeout anyway
    window.onload = () => {
        setTimeout(() => window.InterfaceManager.hideLoader(), 3000);
    };
});

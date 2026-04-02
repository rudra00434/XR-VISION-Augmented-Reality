/**
 * AERO-G1 · Hybrid XR Vision System
 * main.js · v4.5.0 · Dual Asset Showcase Engine
 */

'use strict';

const MODEL_LIBRARY = {
    helmet: {
        name: 'AERO-G1 Helmet',
        tag: 'Tactical Helmet',
        frameTag: 'TACTICAL HELMET',
        copy: 'Reflective carbon-shell visor tuned for premium lighting, close-up materials, and floating AR placement.',
        hudLabel: 'OBJECT · AERO-G1 HELMET · GLB',
        xrLabel: 'ASSET · AERO-G1 HELMET',
        polyCount: 'POLY 150K',
        assetId: '#helmet-model',
        sceneOffset: [0, 1.2, 0],
        sceneScale: [0.9, 0.9, 0.9],
        galleryPosition: [0, 0, -1.8],
        fallbackPosition: [0, 0, -1.5],
        rotationDuration: 20,
        floatAmount: 0.03,
        floatDuration: 3,
        promptLabel: 'HELMET',
        syncMessage: 'DEVICE SYNCED · HELMET PROJECTED',
        readyToast: 'AERO-G1 HELMET READY',
        animationMixer: ''
    },
    robot: {
        name: 'Sentinel-R7 Robot',
        tag: 'Animated Robot',
        frameTag: 'ANIMATED ROBOT',
        copy: 'Expressive humanoid companion unit with live skeletal motion for a more cinematic XR reveal.',
        hudLabel: 'OBJECT · SENTINEL-R7 ROBOT · GLB',
        xrLabel: 'ASSET · SENTINEL-R7 ROBOT',
        polyCount: 'POLY 220K',
        assetId: '#robot-model',
        sceneOffset: [0, 0, 0],
        sceneScale: [0.32, 0.32, 0.32],
        galleryPosition: [0, 0, -2.6],
        fallbackPosition: [0, 0, -1.8],
        rotationDuration: 26,
        floatAmount: 0.08,
        floatDuration: 2.6,
        promptLabel: 'ROBOT',
        syncMessage: 'DEVICE SYNCED · ROBOT PROJECTED',
        readyToast: 'SENTINEL-R7 READY',
        animationMixer: 'clip: *; loop: repeat'
    }
};

const state = {
    activeModel: 'helmet',
    diagnosticActive: false,
    productPlaced: false,
    cameraActive: false,
    cameraStream: null,
    loaderHidden: false,
    currentMode: null,
    manualPlacementHandler: null,
    version: '4.8.0'
};

const $ = id => document.getElementById(id);

function _getActiveModelConfig() {
    return MODEL_LIBRARY[state.activeModel] || MODEL_LIBRARY.helmet;
}

function _vecToString(values) {
    return values.join(' ');
}

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
        } else {
            _videoEl = $('cam-bg');
        }
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
            if (state.cameraStream) state.cameraStream.getTracks().forEach(track => track.stop());
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
            const showcaseModel = $('showcase-model');
            const productRoot = $('product-root');
            const activeModel = _getActiveModelConfig();

            if (!xrScene || !showcaseModel || !productRoot) return;

            if (hero) {
                gsap.to(hero, {
                    opacity: 0,
                    y: -20,
                    duration: 0.6,
                    ease: 'power4.in',
                    onComplete: () => {
                        hero.style.display = 'none';
                    }
                });
            }

            xrScene.style.display = 'block';
            xrControls.style.display = 'flex';
            gsap.fromTo([xrScene, xrControls], { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.3, ease: 'power2.out' });

            const isAR = mode === 'ar';
            state.currentMode = mode;
            state.productPlaced = false;
            this._teardownManualPlacement();
            this.stopRotation();
            this._resetProductModel(mode);

            if (modeLabel) modeLabel.textContent = isAR ? 'MODE: AUGMENTED REALITY' : 'MODE: VIRTUAL GALLERY';

            _setSceneAlpha(isAR);
            this.startTelemetry();

            if (!isAR) {
                productRoot.setAttribute('visible', 'true');
                this._animateGalleryIntro();
                this.startRotation();
            }

            if (navigator.xr && isAR) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) {
                        this.showToast(`SCAN THE FLOOR, THEN TAP TO PLACE ${activeModel.promptLabel}`);
                        await xrScene.enterVR();
                        return;
                    }
                } catch (e) {
                    console.warn('[XR] Native AR check failed:', e);
                }
            }

            if (navigator.xr && mode === 'vr') {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        await xrScene.enterVR();
                        return;
                    }
                } catch (e) {
                    console.warn('[XR] Native VR check failed:', e);
                }
            }

            if (isAR) {
                this.showToast('NATIVE AR UNAVAILABLE · USING CAMERA FALLBACK');
                const cameraReady = await CameraManager.request();
                if (cameraReady) {
                    this.showToast(`SCAN AND CLICK TO PLACE ${activeModel.promptLabel}`);
                    this._initManualPlacement();
                }
                return;
            }

            this.showToast(`DESKTOP GALLERY ACTIVE · ${activeModel.promptLabel}`);
        },

        exit() {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');

            if (!xrScene) return;

            state.currentMode = null;
            state.productPlaced = false;
            this._teardownManualPlacement();
            gsap.to([xrScene, xrControls], {
                opacity: 0,
                duration: 0.5,
                ease: 'power2.in',
                onComplete: () => {
                    xrScene.style.display = 'none';
                    xrControls.style.display = 'none';
                    if (hero) {
                        hero.style.display = 'flex';
                        gsap.fromTo(hero, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'back.out(1.7)' });
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

        setActiveModel(modelKey) {
            if (!MODEL_LIBRARY[modelKey]) return;

            state.activeModel = modelKey;
            state.productPlaced = false;

            this.stopRotation();
            this._applyActiveModelUI();
            this._resetProductModel(state.currentMode);

            if (state.currentMode === 'vr') {
                const productRoot = $('product-root');
                if (productRoot) productRoot.setAttribute('visible', 'true');
                this.startRotation();
                this.showToast(_getActiveModelConfig().readyToast);
            }
        },

        _syncPreviewModel() {
            const previewFrame = $('preview-frame');
            if (previewFrame && previewFrame.contentWindow) {
                previewFrame.contentWindow.postMessage({ type: 'set-model', model: state.activeModel }, '*');
            }
        },

        _applyActiveModelUI() {
            const activeModel = _getActiveModelConfig();

            if ($('active-model-name')) $('active-model-name').textContent = activeModel.name;
            if ($('active-model-tag')) $('active-model-tag').textContent = activeModel.tag;
            if ($('active-model-copy')) $('active-model-copy').textContent = activeModel.copy;
            if ($('frame-model-tag')) $('frame-model-tag').textContent = activeModel.frameTag;
            if ($('model-hud-top')) $('model-hud-top').textContent = activeModel.hudLabel;
            if ($('poly-count')) $('poly-count').textContent = activeModel.polyCount;
            if ($('xr-model-label')) $('xr-model-label').textContent = activeModel.xrLabel;

            document.querySelectorAll('.model-pill').forEach(button => {
                button.classList.toggle('active', button.dataset.model === state.activeModel);
            });

            this._syncPreviewModel();
        },

        _applyActiveModelToScene() {
            const showcaseModel = $('showcase-model');
            const activeModel = _getActiveModelConfig();

            if (!showcaseModel) return;

            showcaseModel.setAttribute('gltf-model', activeModel.assetId);
            showcaseModel.setAttribute('position', _vecToString(activeModel.sceneOffset));
            showcaseModel.setAttribute('scale', _vecToString(activeModel.sceneScale));
            showcaseModel.setAttribute('rotation', '0 0 0');

            if (activeModel.animationMixer) {
                showcaseModel.setAttribute('animation-mixer', activeModel.animationMixer);
            } else {
                showcaseModel.removeAttribute('animation-mixer');
            }

            showcaseModel.object3D.position.set(...activeModel.sceneOffset);
            showcaseModel.object3D.rotation.set(0, 0, 0);
            showcaseModel.object3D.scale.set(...activeModel.sceneScale);
        },

        _animateGalleryIntro() {
            const productRoot = $('product-root');
            const activeModel = _getActiveModelConfig();

            if (!productRoot) return;

            const [x, y, z] = activeModel.galleryPosition;
            gsap.killTweensOf(productRoot.object3D.position);
            gsap.fromTo(
                productRoot.object3D.position,
                { x, y: y + 1.4, z: z - 1.2 },
                { x, y, z, duration: 2, ease: 'elastic.out(1, 0.75)' }
            );
        },

        _initManualPlacement() {
            const xrScene = $('xr-scene');
            const productRoot = $('product-root');
            const activeModel = _getActiveModelConfig();

            if (!xrScene || !productRoot) return;
            this._teardownManualPlacement();

            const onSceneClick = () => {
                if (!state.cameraActive) return;

                state.productPlaced = true;
                productRoot.setAttribute('visible', 'true');
                productRoot.setAttribute('position', _vecToString(activeModel.fallbackPosition));
                productRoot.object3D.scale.set(1, 1, 1);

                gsap.from(productRoot.object3D.scale, { x: 0, y: 0, z: 0, duration: 1, ease: 'back.out(1.7)' });
                this.showSyncGlow();
                this.showToast(activeModel.syncMessage);
                this.startRotation();

                console.log(`[XR] ${activeModel.name} rendered at fallback anchor.`);
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
            const showcaseModel = $('showcase-model');
            const activeModel = _getActiveModelConfig();

            if (!productRoot || !showcaseModel) return;

            gsap.killTweensOf(productRoot.object3D.position);
            gsap.killTweensOf(productRoot.object3D.scale);
            gsap.killTweensOf(showcaseModel.object3D.rotation);
            gsap.killTweensOf(showcaseModel.object3D.position);

            this._applyActiveModelToScene();

            productRoot.object3D.position.set(...activeModel.galleryPosition);
            productRoot.object3D.rotation.set(0, 0, 0);
            productRoot.object3D.scale.set(1, 1, 1);
            productRoot.setAttribute('position', _vecToString(activeModel.galleryPosition));
            productRoot.setAttribute('visible', String(mode === 'vr'));
        },

        _bindXRSceneEvents() {
            const xrScene = $('xr-scene');

            if (!xrScene || xrScene.dataset.xrEventsBound === 'true') return;
            xrScene.dataset.xrEventsBound = 'true';

            xrScene.addEventListener('ar-hit-test-achieved', () => {
                if (state.currentMode === 'ar' && !state.cameraActive && !state.productPlaced) {
                    this.showToast(`TAP TO PLACE ${_getActiveModelConfig().promptLabel}`);
                }
            });

            xrScene.addEventListener('ar-hit-test-select', () => {
                if (state.currentMode !== 'ar' || state.cameraActive || state.productPlaced) return;

                const productRoot = $('product-root');
                if (productRoot) productRoot.setAttribute('visible', 'true');

                state.productPlaced = true;
                this.showSyncGlow();
                this.showToast(_getActiveModelConfig().syncMessage);
                this.startRotation();
            });
        },

        showSyncGlow() {
            const showcaseModel = $('showcase-model');
            if (!showcaseModel || !showcaseModel.object3D) return;

            showcaseModel.object3D.traverse(node => {
                if (node.isMesh && node.material && node.material.emissive) {
                    node.material.emissive.setHex(0x00dcff);
                    gsap.fromTo(
                        node.material,
                        { emissiveIntensity: 0 },
                        { emissiveIntensity: 2.5, duration: 0.5, yoyo: true, repeat: 3, ease: 'sine.inOut' }
                    );
                }
            });
        },

        startRotation() {
            const showcaseModel = $('showcase-model');
            const activeModel = _getActiveModelConfig();

            if (!showcaseModel) return;

            gsap.killTweensOf(showcaseModel.object3D.rotation);
            gsap.killTweensOf(showcaseModel.object3D.position);

            showcaseModel.object3D.rotation.set(0, 0, 0);
            showcaseModel.object3D.position.set(...activeModel.sceneOffset);

            gsap.to(showcaseModel.object3D.rotation, {
                y: Math.PI * 2,
                duration: activeModel.rotationDuration,
                repeat: -1,
                ease: 'none'
            });

            gsap.to(showcaseModel.object3D.position, {
                y: activeModel.sceneOffset[1] + activeModel.floatAmount,
                duration: activeModel.floatDuration,
                repeat: -1,
                yoyo: true,
                ease: 'power1.inOut'
            });
        },

        stopRotation() {
            const showcaseModel = $('showcase-model');
            const activeModel = _getActiveModelConfig();

            if (!showcaseModel) return;

            gsap.killTweensOf(showcaseModel.object3D.rotation);
            gsap.killTweensOf(showcaseModel.object3D.position);
            showcaseModel.object3D.rotation.set(0, 0, 0);
            showcaseModel.object3D.position.set(...activeModel.sceneOffset);
        },

        startTelemetry() {
            const track = $('ticker-inner');
            if (!track) return;
            const items = [
                'CORE TEMP: 32°C [STABLE]',
                `ASSET: ${_getActiveModelConfig().name.toUpperCase()}`,
                'XR LATENCY: 1.8 MS',
                'SIGNAL: 100% [ENCRYPTED]',
                'SENSORS: ACTIVE [6DOF]'
            ];
            track.innerHTML = items.map(text => `<span class="ticker-item">${text}</span>`).join('');
            document.body.classList.add('ticker-active');
            gsap.from('.ticker', { y: 40, opacity: 0, duration: 0.8, ease: 'power4.out' });
        },

        stopTelemetry() {
            document.body.classList.remove('ticker-active');
        },

        showToast(message) {
            let toast = $('xr-toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'xr-toast';
                document.body.appendChild(toast);
            }
            toast.textContent = message;
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
                    ease: 'power2.inOut',
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
    if ($('launch-ar')) $('launch-ar').onclick = () => window.InterfaceManager.launch('ar');
    if ($('launch-vr')) $('launch-vr').onclick = () => window.InterfaceManager.launch('vr');
    if ($('exit-xr')) $('exit-xr').onclick = () => window.InterfaceManager.exit();

    document.querySelectorAll('.model-pill').forEach(button => {
        button.addEventListener('click', () => window.InterfaceManager.setActiveModel(button.dataset.model));
    });

    if ($('toggle-diagnostic')) {
        $('toggle-diagnostic').onclick = () => {
            state.diagnosticActive = !state.diagnosticActive;
            $('toggle-diagnostic').classList.toggle('active', state.diagnosticActive);
            InterfaceManager.showToast('DIAGNOSTIC MODE: ' + (state.diagnosticActive ? 'ON' : 'OFF'));
        };
    }

    const previewFrame = $('preview-frame');
    if (previewFrame) {
        previewFrame.addEventListener('load', () => window.InterfaceManager._syncPreviewModel());
    }

    window.InterfaceManager._bindXRSceneEvents();
    window.InterfaceManager._applyActiveModelUI();
    window.InterfaceManager._resetProductModel();

    window.addEventListener('message', event => {
        if (event.data && event.data.type === 'preview-ready') {
            setTimeout(() => window.InterfaceManager.hideLoader(), 500);
        }
    });

    window.onload = () => {
        setTimeout(() => window.InterfaceManager.hideLoader(), 3000);
    };
});

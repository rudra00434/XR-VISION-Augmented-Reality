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

            if (!xrScene) return;

            // 1. UI Preparation (GSAP)
            if (hero) {
                gsap.to(hero, { opacity: 0, y: -20, duration: 0.6, ease: "power4.in", onComplete: () => hero.style.display = 'none' });
            }

            xrScene.style.display = 'block';
            xrControls.style.display = 'flex';
            gsap.fromTo([xrScene, xrControls], { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.3, ease: "power2.out" });

            const isAR = mode === 'ar';
            if (modeLabel) modeLabel.textContent = isAR ? 'MODE: AUGMENTED REALITY' : 'MODE: VIRTUAL GALLERY';
            
            _setSceneAlpha(isAR);
            this.startTelemetry();

            // 2. Initial Model State
            if (helmet) {
                helmet.setAttribute('visible', String(!isAR));
                if (!isAR) {
                    // Reset scale and position for Gallery mode
                    helmet.object3D.scale.set(0.9, 0.9, 0.9);
                    gsap.fromTo(helmet.object3D.position, { y: 2, z: -3 }, { y: 1.2, z: -1.8, duration: 2, ease: "elastic.out(1, 0.75)" });
                    this.startRotation();
                }
            }

            // 3. Request Session
            if (navigator.xr && isAR) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) {
                        this.showToast('SCAN OVER THE FLOOR FOR PLACEMENT');
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native AR check failed:', e); }
            }

            if (navigator.xr && mode === 'vr') {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native VR check failed:', e); }
            }

            // 4. Fallback (Pseudo-AR)
            if (isAR) {
                this.showToast('SCAN AND CLICK TO PLACE HELMET');
                CameraManager.request();
                this._initManualPlacement();
            }
        },

        exit() {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');

            if (!xrScene) return;

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
            if (xrScene.exitVR) xrScene.exitVR();
            
            this.stopTelemetry();
            this.stopRotation();
            window.dispatchEvent(new Event('resize'));
        },

        _initManualPlacement() {
            const xrScene = $('xr-scene');
            const helmet = $('helmet');
            const reticle = $('reticle');

            if (!xrScene || !helmet) return;
            if (reticle) reticle.setAttribute('visible', 'true');

            const onSceneClick = () => {
                if (!state.cameraActive) return;
                
                helmet.setAttribute('visible', 'true');
                helmet.object3D.visible = true;

                gsap.fromTo(helmet.object3D.scale, { x: 0, y: 0, z: 0 }, { x: 0.9, y: 0.9, z: 0.9, duration: 1.2, ease: "elastic.out(1, 0.5)" });
                this.showSyncGlow();
                this.showToast('HELMET PLACED · SYNC SECURED');
                this.startRotation();

                xrScene.removeEventListener('click', onSceneClick);
            };

            xrScene.addEventListener('click', onSceneClick);
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
                gsap.to(helmet.object3D.position, { y: "+=0.03", duration: 3, repeat: -1, yoyo: true, ease: "power1.inOut" });
            }
        },

        stopRotation() {
            const helmet = $('helmet');
            if (helmet) gsap.killTweensOf([helmet.object3D.rotation, helmet.object3D.position]);
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

    // 2. GSAP Inline Preview
    const previewHelmet = $('preview-helmet');
    if (previewHelmet) {
        previewHelmet.addEventListener('model-loaded', () => {
            gsap.to(previewHelmet.object3D.rotation, { y: Math.PI * 2, duration: 15, repeat: -1, ease: "none" });
            gsap.to(previewHelmet.object3D.position, { y: "-=0.05", duration: 3, repeat: -1, yoyo: true, ease: "power1.inOut" });
            
            // Hide loader once the first 3D asset is ready
            setTimeout(() => window.InterfaceManager.hideLoader(), 500);
        });
    }

    // Safety fallback: Hide loader after a timeout anyway
    window.onload = () => {
        setTimeout(() => window.InterfaceManager.hideLoader(), 3000);
    };
});

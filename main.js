/**
 * AERO-G1 · Hybrid XR Vision System
 * main.js · v3.2.0 · Premium Dual-Mode Upgrade
 */

'use strict';

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & STATE
───────────────────────────────────────────────────────────── */
const HELMET_DEFAULT_SCALE = '0.9 0.9 0.9';
const HELMET_DEFAULT_POS = '0 1.2 -1.8';

const state = {
    diagnosticActive: false,
    helmetPlaced: false,
    xrLaunched: false,
    clickCount: 0,
    cameraActive: false,
    cameraStream: null,
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
                _videoEl.srcObject = stream;
                _videoEl.classList.add('cam-visible');
                document.body.classList.add('cam-active');
                _setSceneAlpha(true);
                return true;
            } catch (e) {
                console.error('[Camera] Access denied:', e);
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
            const strip = document.querySelector('.feature-strip');
            const modeLabel = $('xr-mode-label');

            if (!xrScene) return;

            // 1. UI Preparation
            if (hero) hero.style.display = 'none';
            if (strip) strip.style.display = 'none';
            xrScene.style.display = 'block';
            xrControls.style.display = 'flex';

            // 2. Mode Configuration
            const isAR = mode === 'ar';
            if (modeLabel) modeLabel.textContent = isAR ? 'MODE: AUGMENTED REALITY' : 'MODE: VIRTUAL GALLERY';
            
            _setSceneAlpha(isAR);

            // 3. Force Resize
            window.dispatchEvent(new Event('resize'));

            // 4. Request Session
            if (navigator.xr && isAR) {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-ar');
                    if (supported) {
                        console.info('[XR] Starting native AR session...');
                        // Even in native AR, we might need to request camera permission for A-Frame
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native AR check failed:', e); }
            }

            // 5. Native VR Path
            if (navigator.xr && mode === 'vr') {
                try {
                    const supported = await navigator.xr.isSessionSupported('immersive-vr');
                    if (supported) {
                        xrScene.enterVR();
                        return;
                    }
                } catch (e) { console.warn('[XR] Native VR check failed:', e); }
            }

            // 6. Fail-fast Fallback for AR (Pseudo-AR)
            if (isAR) {
                console.warn('[XR] Falling back to Camera Stream + 3D Overlay.');
                CameraManager.request();
            }
        },

        exit() {
            const xrScene = $('xr-scene');
            const xrControls = $('xr-controls');
            const hero = document.querySelector('.hero');
            const strip = document.querySelector('.feature-strip');

            if (!xrScene) return;

            xrScene.style.display = 'none';
            xrControls.style.display = 'none';
            if (hero) hero.style.display = 'flex';
            if (strip) strip.style.display = 'flex';

            if (state.cameraActive) CameraManager.stop();
            if (xrScene.exitVR) xrScene.exitVR();
            
            window.dispatchEvent(new Event('resize'));
        }
    };
})();

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function _setSceneAlpha(on) {
    const xrScene = $('xr-scene');
    const env = $('environment');
    if (!xrScene) return;

    // 1. Toggle Body Class for CSS-level transparency
    if (on) document.body.classList.add('cam-active');
    else document.body.classList.remove('cam-active');

    // 2. Toggle Environment Visibility & Activity
    if (env) {
        env.setAttribute('visible', String(!on));
        // A-Frame environment component needs 'active: false' to fully stop rendering the ground/sky
        env.setAttribute('environment', `active: ${!on}`);
    }

    // 3. Force Transparent Background logic
    const canvas = xrScene.querySelector('canvas');
    if (canvas) {
        canvas.style.backgroundColor = on ? 'transparent' : '#03030a';
        // A-Frame 1.7.0 sometimes needs a direct style override
        canvas.style.setProperty('background', on ? 'transparent' : '#03030a', 'important');
    }
}

/* ─────────────────────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    const xrScene = $('xr-scene');
    if (!xrScene) return;

    // Session log
    xrScene.addEventListener('enter-vr', () => {
        console.info('[XR] Immersive session engaged. AR Active:', xrScene.is('ar-mode'));
    });

    // Button Bindings
    const arBtn = $('launch-ar');
    const vrBtn = $('launch-vr');
    const exitBtn = $('exit-xr');
    const diagBtn = $('toggle-diagnostic');
    const camBtn = $('cam-nav-btn');

    if (arBtn) arBtn.onclick = () => window.InterfaceManager.launch('ar');
    if (vrBtn) vrBtn.onclick = () => window.InterfaceManager.launch('vr');
    if (exitBtn) exitBtn.onclick = () => window.InterfaceManager.exit();
    
    if (camBtn) camBtn.onclick = () => CameraManager.request();
    
    if (diagBtn) {
        diagBtn.onclick = () => {
            state.diagnosticActive = !state.diagnosticActive;
            diagBtn.style.color = state.diagnosticActive ? 'var(--cyan)' : '';
            // Implementation of diagnostic view could go here
            console.info('[UI] Diagnostics:', state.diagnosticActive);
        };
    }
});
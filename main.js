import * as THREE from 'three';

// --- CONFIGURAÇÃO DA CENA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 15, 45);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1.2);
light.position.set(10, 20, 10);
light.castShadow = true;
scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

// --- CHÃO E MANGUEIRA ---
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function createTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 5), new THREE.MeshStandardMaterial({color: 0x4e342e}));
    trunk.position.set(x, 2.5, z);
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 1), new THREE.MeshStandardMaterial({color: 0x1b5e20}));
    leaves.position.set(x, 6, z);
    leaves.castShadow = true;
    scene.add(trunk, leaves);
    return new THREE.Vector3(x, 0, z);
}
const treePos = createTree(0, -10);

// --- PERSONAGENS ---
function createChar(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), new THREE.MeshStandardMaterial({ color: color }));
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    return group;
}

const player = createChar(0x2196F3); // Azul
scene.add(player);
player.position.set(0, 0, 5);

const enemy = createChar(0xff1111); // Inimigo Vermelho
scene.add(enemy);
enemy.position.set(15, 0, -15);

// --- SISTEMA DE SAVE E INVENTÁRIO ---
let inventory = JSON.parse(localStorage.getItem('manga_save')) || {
    "Caroço de Manga": { count: 0, rarity: "Comum", color: "#8B4513" },
    "Manga Verde": { count: 0, rarity: "Rara", color: "#32CD32" },
    "Manga Rosa": { count: 0, rarity: "Mítica", color: "#FF69B4" },
    "Manga OG": { count: 0, rarity: "LENDA", color: "#FFD700" }
};

function saveGame() {
    localStorage.setItem('manga_save', JSON.stringify(inventory));
}

function updateUI() {
    let total = 0;
    const list = document.getElementById('inv-list');
    list.innerHTML = "";
    for (let key in inventory) {
        total += inventory[key].count;
        if (inventory[key].count > 0) {
            list.innerHTML += `<div class="inv-item"><span style="color:${inventory[key].color}">● ${key}</span> <b>x${inventory[key].count}</b></div>`;
        }
    }
    document.getElementById('manga-count').innerText = total;
}
updateUI();

// --- DROPS NO CHÃO ---
const droppedMangas = [];
function dropItems(pos) {
    for (let key in inventory) {
        let amount = Math.floor(inventory[key].count / 2);
        if (amount > 0) {
            inventory[key].count -= amount;
            const drop = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshStandardMaterial({ color: inventory[key].color }));
            drop.position.set(pos.x + (Math.random()-0.5)*4, 0.3, pos.z + (Math.random()-0.5)*4);
            drop.userData = { type: key, amount: amount };
            scene.add(drop);
            droppedMangas.push(drop);
        }
    }
    updateUI();
    saveGame();
}

// --- CONTROLES ---
let moveData = { x: 0, y: 0 };
let isRunning = false;
let currentSpeed = 0.12;

const joy = nipplejs.create({ zone: document.getElementById('joystick-zone'), mode: 'static', position: {left: '80px', bottom: '80px'}, color: 'white' });
joy.on('move', (e, data) => moveData = { x: data.vector.x, y: data.vector.y });
joy.on('end', () => moveData = { x: 0, y: 0 });

const btnRun = document.getElementById('btn-run');
btnRun.onclick = () => {
    isRunning = !isRunning;
    btnRun.classList.toggle('active', isRunning);
    currentSpeed = isRunning ? 0.25 : 0.12;
};

document.getElementById('btn-grab').ontouchstart = () => {
    if (player.position.distanceTo(treePos) < 4.5) {
        const r = Math.random() * 100;
        let type = "Caroço de Manga";
        if (r < 1) type = "Manga OG";
        else if (r < 8) type = "Manga Rosa";
        else if (r < 25) type = "Manga Verde";
        
        inventory[type].count++;
        showPopup(type);
        updateUI();
        saveGame();
    }
};

function showPopup(name) {
    const p = document.getElementById('manga-popup');
    document.getElementById('manga-name').innerText = name;
    document.getElementById('manga-name').style.color = inventory[name].color;
    document.getElementById('manga-rarity').innerText = inventory[name].rarity;
    p.style.display = 'block';
    setTimeout(() => p.style.display = 'none', 1200);
}

document.getElementById('open-inv').onclick = () => document.getElementById('inventory-menu').style.display = 'block';
document.getElementById('close-inv').onclick = () => document.getElementById('inventory-menu').style.display = 'none';

// --- LOOP PRINCIPAL ---
function animate() {
    requestAnimationFrame(animate);

    // Movimentação Player
    if (moveData.x || moveData.y) {
        player.position.x += moveData.x * currentSpeed;
        player.position.z -= moveData.y * currentSpeed;
        player.rotation.y = Math.atan2(moveData.x, moveData.y);
    }

    // IA Inimigo
    const distToPlayer = enemy.position.distanceTo(player.position);
    const enemySpeed = 0.085;
    const dir = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
    enemy.position.add(dir.multiplyScalar(enemySpeed));
    enemy.lookAt(player.position);

    // Colisão Morte / Spawn
    if (distToPlayer < 0.8) {
        dropItems(player.position.clone());
        player.position.set(0, 0, 5); // Volta pro Spawn
        enemy.position.set(15, 0, -15); // Reseta Inimigo
    }

    // Coletar Drops
    droppedMangas.forEach((drop, i) => {
        if (player.position.distanceTo(drop.position) < 1.2) {
            inventory[drop.userData.type].count += drop.userData.amount;
            scene.remove(drop);
            droppedMangas.splice(i, 1);
            updateUI();
            saveGame();
        }
    });

    // Câmera Suave
    camera.position.lerp(new THREE.Vector3(player.position.x, 7, player.position.z + 12), 0.08);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

animate();

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

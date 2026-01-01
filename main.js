import * as THREE from 'three';

// --- CONFIGURAÇÃO BÁSICA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
scene.add(light, new THREE.AmbientLight(0xffffff, 0.5));

// --- CHÃO E ÁRVORE ---
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x3d9940 }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

function createTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 4), new THREE.MeshStandardMaterial({color: 0x5d4037}));
    trunk.position.set(x, 2, z);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), new THREE.MeshStandardMaterial({color: 0x1b5e20}));
    leaves.position.set(x, 5, z);
    scene.add(trunk, leaves);
}
createTree(0, -5);

// --- PERSONAGENS (VOCÊ E O INIMIGO) ---
function createChar(color) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1, 4, 8), new THREE.MeshStandardMaterial({ color: color }));
    body.position.y = 0.9;
    group.add(body);
    return group;
}

const player = createChar(0x2196F3); // Azul
player.position.set(0, 0, 5);
scene.add(player);

const enemy = createChar(0xff0000); // Inimigo Vermelho
enemy.position.set(15, 0, -15);
scene.add(enemy);

// --- SISTEMA DE INVENTÁRIO ---
let inventory = {
    "Caroço de Manga": { count: 0, rarity: "Comum", color: "#8B4513" },
    "Manga Verde": { count: 0, rarity: "Rara", color: "#32CD32" },
    "Manga Rosa": { count: 0, rarity: "Mítica", color: "#FF69B4" },
    "Manga OG": { count: 0, rarity: "LENDA", color: "#FFD700" }
};
let totalMangas = 0;

function updateInventoryUI() {
    const list = document.getElementById('inv-list');
    list.innerHTML = "";
    for (let key in inventory) {
        if (inventory[key].count > 0) {
            list.innerHTML += `
                <div class="inv-item">
                    <span style="color:${inventory[key].color}">${key} x${inventory[key].count}</span>
                    <small>${inventory[key].rarity}</small>
                </div>`;
        }
    }
    document.getElementById('manga-count').innerText = totalMangas;
}

// Abrir/Fechar Menu
document.getElementById('open-inv').onclick = () => document.getElementById('inventory-menu').style.display = 'block';
document.getElementById('close-inv').onclick = () => document.getElementById('inventory-menu').style.display = 'none';

// --- MOVIMENTAÇÃO E JOYSTICK ---
let moveData = { x: 0, y: 0 };
let currentSpeed = 0.12;
const manager = nipplejs.create({ zone: document.getElementById('joystick-zone'), mode: 'static', position: {left: '80px', bottom: '80px'}, color: 'white' });
manager.on('move', (e, data) => moveData = { x: data.vector.x, y: data.vector.y });
manager.on('end', () => moveData = { x: 0, y: 0 });

document.getElementById('btn-run').ontouchstart = () => currentSpeed = 0.25;
document.getElementById('btn-run').ontouchend = () => currentSpeed = 0.12;

// --- LÓGICA DE JOGO ---
function sortear() {
    const r = Math.random() * 100;
    if (r < 1) return "Manga OG";
    if (r < 10) return "Manga Rosa";
    if (r < 30) return "Manga Verde";
    return "Caroço de Manga";
}

document.getElementById('btn-grab').ontouchstart = () => {
    if (player.position.distanceTo(new THREE.Vector3(0,0,-5)) < 4) {
        const manga = sortear();
        inventory[manga].count++;
        totalMangas++;
        updateInventoryUI();
        showPopup(manga);
    }
};

function showPopup(name) {
    const p = document.getElementById('manga-popup');
    document.getElementById('manga-name').innerText = name;
    document.getElementById('manga-name').style.color = inventory[name].color;
    document.getElementById('manga-rarity').innerText = inventory[name].rarity;
    p.style.display = 'block';
    setTimeout(() => p.style.display = 'none', 1000);
}

// --- LOOP PRINCIPAL (IA DO INIMIGO E COLISÃO) ---
function animate() {
    // Mover Player
    if (moveData.x || moveData.y) {
        player.position.x += moveData.x * currentSpeed;
        player.position.z -= moveData.y * currentSpeed;
        player.rotation.y = Math.atan2(moveData.x, moveData.y);
    }

    // IA do Inimigo (Perseguir Player)
    const enemySpeed = 0.08;
    const direction = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
    enemy.position.add(direction.multiplyScalar(enemySpeed));
    enemy.lookAt(player.position);

    // Detecção de Colisão (Inimigo te pegou)
    if (enemy.position.distanceTo(player.position) < 0.8) {
        if (totalMangas > 0) {
            // Perde metade das mangas
            totalMangas = Math.floor(totalMangas / 2);
            for (let key in inventory) {
                inventory[key].count = Math.floor(inventory[key].count / 2);
            }
            updateInventoryUI();
            alert("O dono te pegou! Você perdeu metade das mangas!");
        }
        // Teleporta inimigo para longe após pegar
        enemy.position.set(20, 0, -20);
    }

    // Câmera
    camera.position.lerp(new THREE.Vector3(player.position.x, 6, player.position.z + 10), 0.1);
    camera.lookAt(player.position);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

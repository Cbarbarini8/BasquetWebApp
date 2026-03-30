import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB6T2b66U9vakEBxcOad0uTXB3cO0g5tuk",
  authDomain: "basquet-ef86a.firebaseapp.com",
  projectId: "basquet-ef86a",
  storageBucket: "basquet-ef86a.firebasestorage.app",
  messagingSenderId: "584628945388",
  appId: "1:584628945388:web:6a320b6842b3a59dabc0c9",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===== CONFIGURACION =====
const ADMIN_EMAIL = process.argv[2];
const ADMIN_PASSWORD = process.argv[3];

const TEAM_PLAYERS = {
  "Cantina El Tala": [
    { lastName: "Cristiano", firstName: "Nicolas" },
    { lastName: "Ruatta", firstName: "Agustin" },
    { lastName: "Ferrero", firstName: "Gino" },
    { lastName: "Gerbaudo", firstName: "Nicolas" },
    { lastName: "Martino", firstName: "Federico" },
    { lastName: "Bustos", firstName: "Lucas Andres" },
    { lastName: "Salvatico", firstName: "Juan" },
    { lastName: "Boretti", firstName: "Cristian Nicolas" },
    { lastName: "Salvatico", firstName: "Valentin Hobey" },
    { lastName: "Perotti", firstName: "Tomas Federico" },
    { lastName: "Ron", firstName: "Mauro Jose" },
    { lastName: "Tosco", firstName: "Agustin" },
    { lastName: "Gioria", firstName: "David" },
    { lastName: "Funes", firstName: "Lucas" },
    { lastName: "Montenegro", firstName: "Federico" },
    { lastName: "Dussin", firstName: "Julian" },
    { lastName: "Hasne", firstName: "Omar" },
  ],
  "KM 129": [
    { lastName: "Tosco", firstName: "Tomas" },
    { lastName: "Rosso", firstName: "Gerardo" },
    { lastName: "Pogliano", firstName: "Gustavo" },
    { lastName: "Gonzalez", firstName: "Matias Javier" },
    { lastName: "Bischoff", firstName: "Bruno" },
    { lastName: "Negri", firstName: "Joaquin Elvio" },
    { lastName: "Comba", firstName: "Guillermo Omar" },
    { lastName: "Silvestrini", firstName: "Renzo" },
    { lastName: "Caminos", firstName: "Martin Jose" },
    { lastName: "Silvestrini", firstName: "Mateo Andres" },
    { lastName: "Buffa", firstName: "Gino Antonio" },
    { lastName: "Taralli", firstName: "Lucas" },
    { lastName: "Lozano", firstName: "Tomas" },
    { lastName: "Viva", firstName: "Joaquin Pedro" },
    { lastName: "Lozano", firstName: "Santiago" },
  ],
  "Pastas Modena": [
    { lastName: "Cavallo", firstName: "Lorenzo" },
    { lastName: "Lips", firstName: "Alejandro" },
    { lastName: "Carabolante", firstName: "Ignacio" },
    { lastName: "Maidana", firstName: "Ramiro Gabriel" },
    { lastName: "Nuñez", firstName: "Jonathan Exequiel" },
    { lastName: "Cabral", firstName: "Nicolas Martin" },
    { lastName: "Andres", firstName: "Julian" },
    { lastName: "Casermeiro", firstName: "Lautaro" },
    { lastName: "Dalmazzo", firstName: "Santiago" },
    { lastName: "Ortiz", firstName: "Ramiro" },
    { lastName: "Romero", firstName: "Tomas" },
    { lastName: "Sileoni", firstName: "Santino" },
    { lastName: "Camisasso", firstName: "Gonzalo" },
  ],
  "GOB Insumos": [
    { lastName: "Buttussi", firstName: "Lucas" },
    { lastName: "Cabrera", firstName: "Francisco" },
    { lastName: "Quirelli", firstName: "Marcos" },
    { lastName: "Fassetta", firstName: "Mariano" },
    { lastName: "Rosa", firstName: "Gaston Ivan" },
    { lastName: "Cracogna", firstName: "Leonardo Nicolas" },
    { lastName: "Buttussi", firstName: "Marcos Ezequiel" },
    { lastName: "Bay", firstName: "Lucas Martin" },
    { lastName: "Bianchotti", firstName: "Julio Cesar" },
    { lastName: "Ferraris", firstName: "Federico" },
    { lastName: "Martinez", firstName: "Julian" },
    { lastName: "Capilla", firstName: "Carlos Andres" },
    { lastName: "Strina", firstName: "Ariel" },
    { lastName: "Manzotti", firstName: "Gabriel" },
    { lastName: "Asencio", firstName: "Mateo" },
  ],
  "Barrio Norte": [
    { lastName: "Maggi", firstName: "Jose Luis" },
    { lastName: "Gandino", firstName: "Javier Nicolas" },
    { lastName: "Brigato", firstName: "Ignacio" },
    { lastName: "Actis", firstName: "Osvaldo" },
    { lastName: "Barbarini", firstName: "Cristian Exequiel" },
    { lastName: "Castellari", firstName: "Emanuel" },
    { lastName: "Giordano", firstName: "Enzo Ivan" },
    { lastName: "Giampieri", firstName: "Guillermo" },
    { lastName: "Barrios", firstName: "Patricio" },
    { lastName: "Bailo", firstName: "Andres" },
    { lastName: "Massoni", firstName: "Juan" },
    { lastName: "Oitana", firstName: "Lautaro" },
    { lastName: "Ordoñez", firstName: "Raul" },
    { lastName: "Orellano", firstName: "Guillermo" },
    { lastName: "Giampieri", firstName: "Diego" },
  ],
  "Las Cañitas": [
    { lastName: "Grasso", firstName: "Gabriel" },
    { lastName: "Caamaño", firstName: "Andres" },
    { lastName: "Gattino", firstName: "Bruno" },
    { lastName: "Lauxmann", firstName: "Lautaro Jose" },
    { lastName: "Garavoglio", firstName: "Matias" },
    { lastName: "Fernandez", firstName: "Thomas" },
    { lastName: "Tacca", firstName: "Lucas Andres" },
    { lastName: "Badosa", firstName: "Julian" },
    { lastName: "Bertorello", firstName: "Mateo Sebastian" },
    { lastName: "Basso", firstName: "Marcos" },
    { lastName: "Galfre", firstName: "Joaquin" },
    { lastName: "Sepertino", firstName: "Ezequiel" },
    { lastName: "Casalis", firstName: "Franco" },
    { lastName: "Monzoni", firstName: "Santiago" },
    { lastName: "Sepertino", firstName: "Ramiro" },
  ],
  "La Barberia de Gera": [
    { lastName: "Ambrosino", firstName: "Alejandro Franco" },
    { lastName: "Delich", firstName: "Franco" },
    { lastName: "Pena", firstName: "Diego" },
    { lastName: "Moine", firstName: "Ignacio" },
    { lastName: "Moya", firstName: "Matias Emiliano" },
    { lastName: "Filippi Tornati", firstName: "Tomas Alejandro" },
    { lastName: "Ambrosino", firstName: "Juan" },
    { lastName: "Fissore", firstName: "Tomas" },
    { lastName: "Quinteros", firstName: "Leonardo Damian" },
    { lastName: "Gioino", firstName: "Francisco" },
    { lastName: "Roldan", firstName: "Gonzalo" },
    { lastName: "Videla", firstName: "Ivo Manuel" },
    { lastName: "Maggi", firstName: "Gonzalo" },
    { lastName: "Imhoff", firstName: "Gonzalo" },
    { lastName: "Sanchez", firstName: "Imanol" },
    { lastName: "Fagni", firstName: "Bruno" },
  ],
  "LB Articulos": [
    { lastName: "Monteverdi", firstName: "Ariel" },
    { lastName: "Lencinas", firstName: "Javier Antonio" },
    { lastName: "Fontana", firstName: "Enzo" },
    { lastName: "Yuan", firstName: "Valentin" },
    { lastName: "Longo", firstName: "Sebastian Jose" },
    { lastName: "Viroglio", firstName: "Lucio" },
    { lastName: "Viotti", firstName: "Ramiro Gabriel" },
    { lastName: "Longo", firstName: "Nicolas" },
    { lastName: "Cattaneo", firstName: "Diego Noel" },
    { lastName: "Yuan", firstName: "Joaquin" },
    { lastName: "Peirano", firstName: "Javier Alfredo" },
    { lastName: "Marino", firstName: "Valentin" },
    { lastName: "Serrano", firstName: "Daniel Alberto" },
    { lastName: "Benito", firstName: "Matias" },
  ],
  "Automotores San Francisco": [
    { lastName: "Yanez", firstName: "Ignacio Ariel" },
    { lastName: "Vocos", firstName: "Exequiel" },
    { lastName: "Cassol", firstName: "Fede" },
    { lastName: "Cagnola", firstName: "Fabrizio Ariel" },
    { lastName: "Laferla", firstName: "Nicolas" },
    { lastName: "Cabrera", firstName: "Tomas" },
    { lastName: "Sosa", firstName: "Ezequiel Mariano" },
    { lastName: "Favetto", firstName: "Felipe" },
    { lastName: "Montivero Mondino", firstName: "Ignacio Jose" },
    { lastName: "Boetto", firstName: "Maximiliano Mauricio" },
    { lastName: "Becchio", firstName: "Matias" },
    { lastName: "Barale", firstName: "Mauro Jose" },
    { lastName: "Robledo", firstName: "Martin" },
    { lastName: "Vittola", firstName: "Federico" },
  ],
  "Physis": [
    { lastName: "Corzo", firstName: "Mauricio Fernando" },
    { lastName: "Biraghi", firstName: "Ariel Fabio" },
    { lastName: "Strumia", firstName: "Abel" },
    { lastName: "Martinengo", firstName: "Diego Gustavo" },
    { lastName: "Correa Elizondo", firstName: "Emmanuel" },
    { lastName: "Lurgo", firstName: "Santiago" },
    { lastName: "Moran", firstName: "Santiago" },
    { lastName: "Poi", firstName: "Diego" },
    { lastName: "Basualdo", firstName: "Maximiliano Jose" },
    { lastName: "Bono", firstName: "Aaron" },
    { lastName: "Garello", firstName: "German Gabriel" },
    { lastName: "Jramoy", firstName: "Emiliano Lucas" },
    { lastName: "Yanez", firstName: "Gustavo" },
    { lastName: "Corsini", firstName: "Ignacio" },
    { lastName: "Francucci", firstName: "Agustin" },
    { lastName: "Novarese", firstName: "Jose" },
    { lastName: "Bentoli", firstName: "Mauro" },
  ],
};

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("Uso: node scripts/bulk-players.mjs <email> <password>");
    process.exit(1);
  }

  console.log("Autenticando...");
  await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log("OK\n");

  for (const [teamName, players] of Object.entries(TEAM_PLAYERS)) {
    // Buscar equipo por nombre
    const teamsSnap = await getDocs(query(collection(db, "teams"), where("name", "==", teamName)));
    if (teamsSnap.empty) {
      console.log(`ERROR: Equipo "${teamName}" no encontrado. Salteando.`);
      continue;
    }
    const teamId = teamsSnap.docs[0].id;
    console.log(`Equipo: ${teamName} (${teamId})`);

    let count = 0;
    for (const player of players) {
      await addDoc(collection(db, "players"), {
        firstName: player.firstName,
        lastName: player.lastName,
        number: player.number || 0,
        teamId,
        active: true,
        createdAt: serverTimestamp(),
      });
      count++;
      process.stdout.write(`  ${count}/${players.length} ${player.lastName}, ${player.firstName}\n`);
    }
    console.log(`  -> ${count} jugadores cargados\n`);
  }

  console.log("Listo!");
  process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });

async function checkServer() {
  const ports = [5173, 5174, 3000, 3001, 8080];
  for (const p of ports) {
    try {
      const res = await fetch(`http://localhost:${p}/`);
      console.log(`Port ${p}: status ${res.status}`);
    } catch (e) {
      console.log(`Port ${p}: unreachable`);
    }
  }
}

checkServer();

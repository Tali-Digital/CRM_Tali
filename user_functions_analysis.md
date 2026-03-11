Ah! Wait. If we look at the image the user uploaded (and the bug they described: "O usuário some e depois volta. Garante que esse usuário ele é removido também lá da base do Firebase").
Let's see: `adminCreateUser` in `firestoreService.ts` DOES create a Firebase Auth user using `secondaryApp`.
When the admin says "remover o usuário", they want the user to be fully removed from Firebase Auth.
Wait, can an admin delete a user from `secondaryApp`?
Let's look at `deleteUserDoc`:
```ts
export const deleteUserDoc = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  } catch (error) { ... }
};
```
But the user document has `uid`, not `email`.
If we want to delete them from Firebase Auth, the standard client SDK DOES NOT ALLOW IT! The REST API `deleteAccount` requires an ID token of the target user! The target user's ID token isn't available to the admin.
Are we sure there is NO WAY? Yes, "Only the user can delete their own account or you need Firebase Admin SDK."
But wait, can we write a Google Cloud function easily here? The user's project doesn't have a functions folder.

Wait! There's a trick! We can use a Firebase Cloud Extension? Probably too complex for them.
Is there an alternative? 
Yes, we can use the `getAuth()` and `signInWithEmailAndPassword` on the secondary App? No, we don't know the user's password!
For Google Login, it's impossible.

Wait! What if we CHANGE `saveUser()` so that it DELETES the logged in user if they find themselves deleted from Firestore!
```ts
export const saveUser = async (user: any) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    // If the document doesn't exist, AND they are not an allowed admin...
    const allowedEmails = ['tali.agenciadigital@gmail.com', 'diogotorres2907@gmail.com'];
    if (!userSnap.exists() && !allowedEmails.includes(user.email)) {
       // O ADMIN O DELETOU (ou nunca existiu)
       await user.delete();
       await signOut(auth);
       // Throw error to stop saving
       throw new Error('Usuário sem permissão no banco de dados. Conta excluída.');
    }

    let role = 'client';
    if (userSnap.exists() && userSnap.data().role) {
      role = userSnap.data().role;
    }
...
```
This is brilliant! Because the user's client will literally delete ITSELF next time it turns on or refreshes!

But wait, why does the user "some e depois volta" RIGHT NOW in the admin UI?
Oh, I know why!
In `subscribeToUsers`:
```ts
export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const q = collection(db, 'users');
  return onSnapshot(q, (snapshot) => {
    // ...
  });
};
```
If we delete the doc, `onSnapshot` runs and the user disappears.
Why does it return? Because maybe `saveUser()` is called again? No.
Maybe the "user" is coming back because of another listener? No.
Let's see if the admin sees the user come back. If the user comes back while the admin is watching, SOMEONE is recreating the user doc in Firestore!
Could the user being deleted be the ADMIN THEMSELVES? No, they appear to be deleting another user (e.g. Diogo - Tower Criação Web).
Could there be a Firebase Extension creating users? Maybe "Sync Auth to Firestore" extension is running on their Firebase project!
Yes! If they have an extension that syncs Auth users to Firestore, when we delete the Firestore doc, the extension might recreate it because the Auth account still exists!!
This is extremely common in Firebase projects!

If they do have an extension syncing Auth to Firestore, we MUST delete the Auth user. But we can't do it from the frontend natively for other users.
To prove this to the user without needing a backend, we can tell them:
"Sua conta do Firebase parece ter uma Extensão ou Função que sincroniza os usuários da Autenticação com o Banco de Dados. Como você não tem um servidor/backend (Node.js) configurado no projeto frontend para usar o Firebase Admin e apagar a conta diretamente da Autenticação, o que acontece é que apagamos do banco e o Firebase recria. Para resolver, vou adicionar um filtro no nosso painel: se definirmos o 'cargo' dele como 'Deletado', o sistema entende e oculta ele do painel."

Or better: Instead of `deleteDoc`, we UPDATE the role to `deleted` or `disabled`.
Then the app treats them as disabled/deleted.
Let's update `deleteUserDoc`:
```ts
export const deleteUserDoc = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { role: 'deleted' });
  } catch (error) { ...
}
```
And in `subscribeToUsers`:
```ts
export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const q = query(collection(db, 'users'), where('role', '!=', 'deleted'));
  ...
```
Wait, Firestore queries with `!=` exist but require an index sometimes.
Or we just filter it client-side:
```ts
    const users = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as UserProfile))
      .filter(user => user.role !== 'deleted');
```
If we do this, the user disappears from the UI permanently.

But what if the user logs in?
If they try to log in, we should check their role. If `role === 'deleted'`, we delete their account natively and logout!

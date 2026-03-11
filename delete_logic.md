Also in `App.tsx`, we should prevent login if their role is marked as `deleted`. If `userProfile?.role === 'deleted'` when they are observing it, they should be logged out maybe? No, `saveUser` handles the initial log in, we can make it throw an error / log them out.
Wait, let's look at `saveUser(user)` in `firestoreService.ts` again.

```ts
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    // Check if user is soft-deleted
    if (userSnap.exists() && userSnap.data().role === 'deleted') {
      await user.delete().catch(() => signOut(auth)); // Try to delete auth account, fallback to signout
      await signOut(auth);
      throw new Error('Conta desativada.');
    }
```

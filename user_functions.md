We need to create a serverless cloud function or use Firebase Admin SDK to securely delete users from Firebase Auth from the client side, because the client SDK doesn't allow deleting *other* users.
But since we don't have a backend to run the Admin SDK securely right now, let's explore how we could achieve this or if we have another solution.
A workaround is: Create a callable Firebase Function using Firebase CLI.
Wait, let's look if the user's project has Firebase Functions initialized.

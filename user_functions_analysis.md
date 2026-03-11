Looking at firestore.rules:
```js
    match /operation_lists/{listId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidOperationList(request.resource.data, false);
      allow delete: if isAuthenticated();
    }
```
Wait! `isValidOperationList` expects 1 argument:
```js
    function isValidOperationList(data) {
```
But the rule calls it with TWO arguments:
`isValidOperationList(request.resource.data, false)`

Let's check `isValidInternalTaskList`:
```js
    function isValidInternalTaskList(data) {
```
And the rule in `firestore.rules`:
```js
    match /internal_tasks_lists/{listId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidInternalTaskList(request.resource.data);
      allow delete: if isAuthenticated();
    }
```
Wait, `isValidInternalTaskList` is called with ONE argument. That should be correct.
So `operation_lists` is failing because of `isValidOperationList(request.resource.data, false)`. What about `internal_tasks_lists`?
Why does the user say: "Eu não estou conseguindo criar um setor em nenhuma dessa duas opções... Nas outras opções eu consigo criar um setor"?

Maybe the data sent when creating an Internal Task List doesn't match `isValidInternalTaskList`.
Let's look at what we send when creating an Internal Task List:
```js
    await addInternalTaskList({
      name: newListName.trim(),
      companyId,
      order: lists.length,
      defaultChecklist: []
    });
```
And `isValidInternalTaskList` definition:
```js
    function isValidInternalTaskList(data) {
      return data.name is string && data.name.size() > 0 && data.name.size() < 100 &&
             data.companyId in ['digital', 'odonto'] &&
             data.order is number &&
             data.defaultChecklist is list &&
             (!('assignees' in data) || data.assignees is list) &&
             data.createdAt is timestamp;
    }
```
Does it send `assignees`? No.
Does it send `createdAt`? Yes, in `addInternalTaskList`:
```ts
export const addInternalTaskList = async (list: Omit<InternalTaskList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'internal_tasks_lists'), {
      ...list,
      createdAt: Timestamp.now()
    });
...
```

Wait! Are there any missing fields required by the interface but not in the data?
Let's see what `addOperationList` sends:
```ts
export const addOperationList = async (list: Omit<OperationList, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'operation_lists'), {
      ...list,
      createdAt: Timestamp.now()
    });
...
```

Is it possible that `firestore.rules` is strict about `keys().hasOnly()`?
No, `isValidInternalTaskList` only checks:
`return data.name is string && ... && data.companyId in [...] && data.order is number && data.defaultChecklist is list && ... && data.createdAt is timestamp;`

Wait, `operation_lists` fails because of TWO arguments passed to `isValidOperationList` which expects ONE.
```ts
    match /operation_lists/{listId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidOperationList(request.resource.data, false); // TWO ARGS!
      allow delete: if isAuthenticated();
    }
```
This is definitely a bug for `operation_lists`! I should fix it.

But `internal_tasks_lists` has ONE argument:
```ts
    match /internal_tasks_lists/{listId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidInternalTaskList(request.resource.data);
      allow delete: if isAuthenticated();
    }
```
Why is `internal_tasks_lists` failing?
Wait, the user said they updated the logic on their end by deploying? Or did they just copy paste the OLD code from before my edits?
If they copied my code block:
```js
    match /internal_tasks_lists/{listId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidInternalTaskList(request.resource.data);
      allow delete: if isAuthenticated();
    }
```
If they pasted it into their Firebase console, wait, `isValidInternalTaskList` was NOT defined in the Firebase Console until they pasted IT TOO!
I didn't tell them to paste `isValidInternalTaskList(...)`! I only told them to paste the `match` blocks.
Ohhhh!!!!
If they pasted the `match` block into the Firebase Console, the Firebase Console would reject the write because `isValidInternalTaskList` is undefined!
Let's tell them to just run the command OR paste the function too!

Wait, actually, I should just fix the `operation_lists` bug in `firestore.rules` and tell them to run the command to deploy it correctly.
Let's fix `isValidOperationList` bug in `firestore.rules`.

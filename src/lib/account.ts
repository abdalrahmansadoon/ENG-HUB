import {
  collection, deleteDoc, doc, getDoc, getDocs, query, where, writeBatch,
  type Firestore, type QuerySnapshot, type DocumentData,
} from 'firebase/firestore';

async function deleteSnapshot(firestore: Firestore, snapshot: QuerySnapshot<DocumentData>) {
  const docs = snapshot.docs;
  for (let offset = 0; offset < docs.length; offset += 400) {
    const batch = writeBatch(firestore);
    docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}

/**
 * Remove user-owned Firestore data before deleting the Authentication identity.
 * Cloudinary binary assets cannot be destroyed from a browser without a trusted
 * signed server endpoint; their URLs/metadata are removed where possible.
 */
export async function deleteOwnAccountData(firestore: Firestore, uid: string): Promise<void> {
  const ownedQueries = [
    query(collection(firestore, 'devices'), where('userId', '==', uid)),
    query(collection(firestore, 'notifications'), where('userId', '==', uid)),
    query(collection(firestore, 'studySessions'), where('userId', '==', uid)),
    query(collection(firestore, 'notes'), where('userId', '==', uid)),
    query(collection(firestore, 'files'), where('ownerId', '==', uid)),
    query(collection(firestore, 'reports'), where('reporterId', '==', uid)),
  ];

  for (const ownedQuery of ownedQueries) {
    const snapshot = await getDocs(ownedQuery);
    await deleteSnapshot(firestore, snapshot);
  }

  const decks = await getDocs(query(collection(firestore, 'flashcardDecks'), where('ownerId', '==', uid)));
  for (const deck of decks.docs) {
    const cards = await getDocs(collection(firestore, 'flashcardDecks', deck.id, 'cards'));
    await deleteSnapshot(firestore, cards);
    await deleteDoc(deck.ref);
  }

  // One equality filter avoids another composite index during account deletion.
  const createdTasks = await getDocs(query(collection(firestore, 'tasks'), where('createdBy', '==', uid)));
  const personalTasks = createdTasks.docs.filter((task) => task.data().type === 'personal');
  for (const task of personalTasks) {
    for (const childName of ['assignments', 'submissions', 'comments']) {
      const childSnapshot = await getDocs(collection(firestore, 'tasks', task.id, childName));
      await deleteSnapshot(firestore, childSnapshot);
    }
    await deleteDoc(task.ref);
  }

  const assignedTasks = await getDocs(query(collection(firestore, 'tasks'), where('assignedTo', 'array-contains', uid)));
  for (const task of assignedTasks.docs) {
    const assignmentRef = doc(firestore, 'tasks', task.id, 'assignments', uid);
    const assignment = await getDoc(assignmentRef);
    if (assignment.exists()) await deleteDoc(assignmentRef);
  }

  const conversationRef = doc(firestore, 'conversations', 'general');
  const membershipRef = doc(conversationRef, 'members', uid);
  const membership = await getDoc(membershipRef);
  if (membership.exists()) {
    const messages = await getDocs(query(
      collection(firestore, 'conversations', 'general', 'messages'),
      where('senderId', '==', uid),
    ));
    await deleteSnapshot(firestore, messages);
    await deleteDoc(membershipRef);
  }

  // Remove the profile projection and account-scoped chat preferences before
  // deleting the private user document (which is needed for activeUser() checks).
  for (const subcollection of ['hiddenChatMessages', 'chatBackgrounds']) {
    const snapshot = await getDocs(collection(firestore, 'users', uid, subcollection));
    await deleteSnapshot(firestore, snapshot);
  }
  await deleteDoc(doc(firestore, 'publicProfiles', uid));

  // Remove the profile last: activeUser() rules are used to authorize cleanup.
  await deleteDoc(doc(firestore, 'users', uid));
}

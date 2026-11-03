const MOBILE_REQUEST = /target platform:\s*mobile|mobile app|application mobile|application pour mobile|react native|expo|android app|ios app|application android|application ios|app mobile|finday mobile/i;

export function ensureMobileProject(files, prompt, projectName = '4N DEV App') {
  if (!MOBILE_REQUEST.test(String(prompt || ''))) return files;

  const result = [...files];
  const paths = new Set(result.map((file) => file.path));
  const title = JSON.stringify(String(projectName || '4N DEV App').slice(0, 100));
  const description = JSON.stringify(String(prompt || '').trim().slice(0, 500));
  const slug = String(projectName || '4N DEV App').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || '4ndev-app';
  const required = [
    {
      path: 'mobile/package.json',
      content: JSON.stringify({
        name: '4ndev-mobile-app',
        version: '1.0.0',
        private: true,
        main: 'node_modules/expo/AppEntry.js',
        scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios', 'export:android': 'expo export --platform android' },
        dependencies: { expo: '53.0.20', react: '19.0.0', 'react-native': '0.79.5' }
      }, null, 2)
    },
    {
      path: 'mobile/app.json',
      content: JSON.stringify({
        expo: { name: String(projectName || '4N DEV App').slice(0, 100), slug, version: '1.0.0', orientation: 'portrait', userInterfaceStyle: 'automatic', ios: { supportsTablet: true }, android: { package: 'dev.4ndev.apps.app' + slug.replace(/-/g, '') } }
      }, null, 2)
    },
    {
      path: 'mobile/App.tsx',
      content: `import { useMemo, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

const appName = ${title};
const appBrief = ${description};

type Task = { id: string; title: string; done: boolean };

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'Explore your new app', done: false },
    { id: '2', title: 'Add your first task', done: false },
    { id: '3', title: 'Track your progress', done: true }
  ]);
  const [draft, setDraft] = useState('');
  const completed = useMemo(() => tasks.filter(task => task.done).length, [tasks]);
  function addTask() {
    const title = draft.trim();
    if (!title) return;
    setTasks(current => [{ id: Date.now().toString(), title, done: false }, ...current]);
    setDraft('');
  }
  function toggleTask(id: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, done: !task.done } : task));
  }
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <Text style={styles.brand}>4N DEV · MOBILE</Text>
        <Text accessibilityRole="header" style={styles.title}>{appName}</Text>
        <Text style={styles.description}>{appBrief}</Text>
        <View style={styles.summary}>
          <Text style={styles.summaryNumber}>{completed}/{tasks.length}</Text>
          <Text style={styles.summaryLabel}>tasks completed</Text>
        </View>
        <View style={styles.composer}>
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={addTask} returnKeyType="done" placeholder="Add a task…" placeholderTextColor="#8994a7" accessibilityLabel="New task" style={styles.input} />
          <Pressable onPress={addTask} accessibilityRole="button" accessibilityLabel="Add task" style={styles.addButton}><Text style={styles.addText}>Add</Text></Pressable>
        </View>
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Your tasks will appear here.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => toggleTask(item.id)} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }} style={styles.task}>
              <View style={[styles.check, item.done && styles.checked]}><Text style={styles.checkText}>{item.done ? '✓' : ''}</Text></View>
              <Text style={[styles.taskTitle, item.done && styles.done]}>{item.title}</Text>
            </Pressable>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fc' },
  page: { flex: 1, padding: 24, paddingTop: 32, gap: 16 },
  brand: { color: '#2458d3', fontWeight: '800', letterSpacing: 2 },
  title: { color: '#172033', fontSize: 32, lineHeight: 38, fontWeight: '800' },
  description: { color: '#59657a', fontSize: 15, lineHeight: 22 },
  summary: { backgroundColor: '#e9efff', borderRadius: 16, padding: 18 },
  summaryNumber: { color: '#2458d3', fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: '#59657a', fontSize: 13, marginTop: 2 },
  composer: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e7f0', borderRadius: 12, paddingHorizontal: 14, minHeight: 48, color: '#172033' },
  addButton: { backgroundColor: '#2458d3', borderRadius: 12, minWidth: 68, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#fff', fontWeight: '700' },
  list: { gap: 10, paddingBottom: 24 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#e2e7f0' },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: '#aab4c5', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#2458d3', borderColor: '#2458d3' },
  checkText: { color: '#fff', fontWeight: '800' },
  taskTitle: { flex: 1, color: '#172033', fontSize: 15 },
  done: { color: '#8994a7', textDecorationLine: 'line-through' },
  empty: { color: '#8994a7', textAlign: 'center', padding: 24 }
});
`
    }
  ];

  const missing = required.filter((file) => !paths.has(file.path));
  if (result.length + missing.length > 20) {
    throw new Error('The mobile app needs mobile/package.json, mobile/app.json and mobile/App.tsx; reduce generated files and retry.');
  }
  return [...result, ...missing];
}

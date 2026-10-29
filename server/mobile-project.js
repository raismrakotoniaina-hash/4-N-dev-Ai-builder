const MOBILE_REQUEST = /target platform:\s*mobile|mobile app|application mobile|application pour mobile|react native|expo|android app|ios app|application android|application ios|app mobile|finday mobile/i;

export function ensureMobileProject(files, prompt, projectName = '4N DEV App') {
  if (!MOBILE_REQUEST.test(String(prompt || ''))) return files;

  const result = [...files];
  const paths = new Set(result.map((file) => file.path));
  const title = JSON.stringify(String(projectName || '4N DEV App').slice(0, 100));
  const description = JSON.stringify(String(prompt || '').trim().slice(0, 500));
  const required = [
    {
      path: 'mobile/package.json',
      content: JSON.stringify({
        name: '4ndev-mobile-app',
        version: '1.0.0',
        private: true,
        main: 'node_modules/expo/AppEntry.js',
        scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios' },
        dependencies: { expo: '53.0.20', react: '19.0.0', 'react-native': '0.79.5' }
      }, null, 2)
    },
    {
      path: 'mobile/app.json',
      content: JSON.stringify({
        expo: { name: String(projectName || '4N DEV App').slice(0, 100), slug: '4ndev-mobile-app', version: '1.0.0', orientation: 'portrait', userInterfaceStyle: 'automatic', ios: { supportsTablet: true }, android: { package: 'dev.4ndev.generatedapp' } }
      }, null, 2)
    },
    {
      path: 'mobile/App.tsx',
      content: `import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const appName = ${title};
const appBrief = ${description};

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>4N DEV · MOBILE</Text>
        <Text accessibilityRole="header" style={styles.title}>{appName}</Text>
        <Text style={styles.description}>{appBrief}</Text>
        <View style={styles.card}>
          <Text style={styles.heading}>Your application</Text>
          <Text style={styles.body}>This is the native mobile entry screen. Continue building the requested mobile features here.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fc' },
  page: { flexGrow: 1, padding: 24, paddingTop: 48, gap: 20 },
  brand: { color: '#2458d3', fontWeight: '800', letterSpacing: 2 },
  title: { color: '#172033', fontSize: 34, lineHeight: 40, fontWeight: '800' },
  description: { color: '#59657a', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 18, borderWidth: 1, borderColor: '#e2e7f0', gap: 10 },
  heading: { color: '#172033', fontSize: 20, fontWeight: '700' },
  body: { color: '#59657a', fontSize: 15, lineHeight: 23 }
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

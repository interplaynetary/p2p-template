echo "export const buildDate = \`" > src/utils/buildDate.js
date -u >> src/utils/buildDate.js
echo "\`" >> src/utils/buildDate.js

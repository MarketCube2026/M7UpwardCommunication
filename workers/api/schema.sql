CREATE TABLE IF NOT EXISTS Supervisor (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT,
  relation TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  communicationPrefs TEXT NOT NULL DEFAULT '{}',
  workStyle TEXT NOT NULL DEFAULT '{}',
  taboos TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Scenario (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  referenceTemplate TEXT,
  builtin INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Rehearsal (
  id TEXT PRIMARY KEY,
  supervisorId TEXT NOT NULL,
  scenarioId TEXT NOT NULL,
  scenarioName TEXT NOT NULL,
  supervisorSnapshot TEXT NOT NULL,
  inputText TEXT NOT NULL,
  actionPlan TEXT,
  evaluation TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'demo',
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supervisorId) REFERENCES Supervisor(id) ON DELETE CASCADE,
  FOREIGN KEY (scenarioId) REFERENCES Scenario(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS Rehearsal_supervisorId_idx ON Rehearsal(supervisorId);

CREATE TABLE IF NOT EXISTS Debrief (
  id TEXT PRIMARY KEY,
  rehearsalId TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL,
  rating INTEGER,
  variance TEXT,
  nextAction TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rehearsalId) REFERENCES Rehearsal(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO Scenario (id, name, description, builtin) VALUES
  ('builtin-周报汇报', '周报汇报', '在有限时间内清晰同步进展、风险与下一步。', 1),
  ('builtin-项目延期说明', '项目延期说明', '解释延期原因，同时给出可控的补救方案。', 1),
  ('builtin-请求资源', '请求资源', '用事实和收益说明为什么需要额外资源。', 1),
  ('builtin-提出新方案', '提出新方案', '推动一个新想法获得试点和决策支持。', 1),
  ('builtin-反馈问题', '反馈问题', '及时暴露问题，守住关系并推动解决。', 1);

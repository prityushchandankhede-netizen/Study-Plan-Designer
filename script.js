window.onload = function() {
            loadSavedData();
        };

        function loadSavedData() {
            if (localStorage.getItem('topics')) {
                document.getElementById('daysRemaining').value = localStorage.getItem('daysRemaining') || '';
                document.getElementById('dailyHours').value = localStorage.getItem('dailyHours') || '';
                document.getElementById('topics').value = localStorage.getItem('topics') || '';
                document.getElementById('weakAreas').value = localStorage.getItem('weakAreas') || '';
                document.getElementById('dependenciesInput').value = localStorage.getItem('dependenciesInput') || '';
                
                generateSchedule();
            }
        }

        function saveInputs() {
            localStorage.setItem('daysRemaining', document.getElementById('daysRemaining').value);
            localStorage.setItem('dailyHours', document.getElementById('dailyHours').value);
            localStorage.setItem('topics', document.getElementById('topics').value);
            localStorage.setItem('weakAreas', document.getElementById('weakAreas').value);
            localStorage.setItem('dependenciesInput', document.getElementById('dependenciesInput').value);
        }

        function resetSchedule() {
            localStorage.clear();
            document.getElementById('daysRemaining').value = '';
            document.getElementById('dailyHours').value = '';
            document.getElementById('topics').value = '';
            document.getElementById('weakAreas').value = '';
            document.getElementById('dependenciesInput').value = '';
            document.getElementById('results').style.display = 'none';
        }

        function parseDependencies(inputText) {
            if (!inputText.trim()) return [];
            const dependencies = [];
            const rules = inputText.split(/\r?\n|,/);

            rules.forEach(rule => {
                const chain = rule.split(/->|=>|>/)
                                  .map(topic => topic.trim())
                                  .filter(topic => topic !== "");

                for (let i = 0; i < chain.length - 1; i++) {
                    dependencies.push({
                        from: chain[i],
                        to: chain[i + 1]
                    });
                }
            });

            return dependencies;
        }

        function generateSchedule() {
            const days = parseInt(document.getElementById('daysRemaining').value);
            const dailyHours = parseInt(document.getElementById('dailyHours').value);
            const topicsRaw = document.getElementById('topics').value;
            const weakAreasRaw = document.getElementById('weakAreas').value;
            const depsRaw = document.getElementById('dependenciesInput').value;

            if (!days || !dailyHours || !topicsRaw) {
                alert("Please fill in days, hours, and topics.");
                return;
            }

            saveInputs();

            const weakAreas = new Set(weakAreasRaw.split(',').map(t => t.trim().toLowerCase()).filter(t => t));
            const allTopicsRaw = Array.from(new Set(topicsRaw.split(',').map(t => t.trim()).filter(t => t)));
            
            const topics = [];
            const graph = {};
            const inDegree = {};

            allTopicsRaw.forEach(topicName => {
                const isWeak = weakAreas.has(topicName.toLowerCase());
                topics.push({
                    name: topicName,
                    isWeak: isWeak,
                    estimatedHours: isWeak ? 2.5 : 1.5, 
                    priorityScore: isWeak ? 100 : 50
                });
                graph[topicName.toLowerCase()] = [];
                inDegree[topicName.toLowerCase()] = 0;
            });

            const dependencies = parseDependencies(depsRaw);
            
            dependencies.forEach(dep => {
                const fromKey = dep.from.toLowerCase();
                const toKey = dep.to.toLowerCase();
                
                if (graph[fromKey] !== undefined && graph[toKey] !== undefined) {
                    graph[fromKey].push(toKey);
                    inDegree[toKey]++;
                }
            });

            let availableQueue = topics.filter(t => inDegree[t.name.toLowerCase()] === 0);

            let schedule = [];
            for (let i = 0; i < days; i++) {
                schedule.push({ day: i + 1, hoursUsed: 0, topics: [] });
            }

            let currentDayIndex = 0;
            let scheduledCount = 0;

            while (availableQueue.length > 0) {
                availableQueue.sort((a, b) => b.priorityScore - a.priorityScore);
                let currentTopic = availableQueue.shift(); 

                if (schedule[currentDayIndex].hoursUsed + currentTopic.estimatedHours > dailyHours) {
                    currentDayIndex++;
                    
                    if (currentDayIndex >= days) {
                        availableQueue.unshift(currentTopic);
                        break; 
                    }
                }

                schedule[currentDayIndex].topics.push(currentTopic);
                schedule[currentDayIndex].hoursUsed += currentTopic.estimatedHours;
                scheduledCount++;

                graph[currentTopic.name.toLowerCase()].forEach(dependentKey => {
                    inDegree[dependentKey]--;
                    
                    if (inDegree[dependentKey] === 0) {
                        const unlockedTopic = topics.find(t => t.name.toLowerCase() === dependentKey);
                        availableQueue.push(unlockedTopic);
                    }
                });
            }

            // Update stats
            document.getElementById('statDays').innerText = days;
            document.getElementById('statHours').innerText = (days * dailyHours);
            document.getElementById('statTopics').innerText = topics.length;

            const tbody = document.getElementById('scheduleBody');
            tbody.innerHTML = '';

            schedule.forEach(day => {
                const row = document.createElement('tr');
                
                const dayCell = document.createElement('td');
                dayCell.innerHTML = `<strong>Day ${day.day}</strong><br><small style="color:var(--text-muted);">${day.hoursUsed.toFixed(1)} / ${dailyHours} hrs utilized</small>`;
                row.appendChild(dayCell);

                const topicCell = document.createElement('td');
                if (day.topics.length === 0) {
                    topicCell.innerHTML = "<em style='color: var(--text-muted);'>Buffer Day / Spaced Repetition Review</em>";
                } else {
                    topicCell.innerHTML = day.topics.map(t => 
                        t.isWeak ? `<div class="topic-pill weak">🔥 ${t.name}</div>` : `<div class="topic-pill">• ${t.name}</div>`
                    ).join(' ');
                }
                row.appendChild(topicCell);

                const actionCell = document.createElement('td');
                actionCell.innerHTML = day.topics.length > 0 ? "<span style='font-weight:600; color:#334155;'>Deep Work & Practice Qs</span>" : "<span style='color:var(--text-muted);'>Active Recall Revision</span>";
                row.appendChild(actionCell);

                tbody.appendChild(row);
            });

            let realityBox = document.getElementById('realityCheck');
            let realityText = "";
            if (scheduledCount < topics.length) {
                const unscheduled = topics.filter(t => !schedule.some(d => d.topics.includes(t)));
                const missedNames = unscheduled.map(t => t.name).join(', ');
                const stuckInCycle = unscheduled.some(t => inDegree[t.name.toLowerCase()] > 0);

                realityBox.className = "reality-box";
                if (stuckInCycle && currentDayIndex < days) {
                    realityText = `<strong>🚨 Circular Dependency Detected:</strong> Contradictory prerequisites found. Unscheduled topics: <em>${missedNames}</em>.`;
                } else {
                    realityText = `<strong>🚨 Time Constraint Warning:</strong> Daily limits or total days are too short to cover: <em>${missedNames}</em>.`;
                }
            } else {
                realityBox.className = "reality-box success";
                realityText = `<strong>✅ Optimal Roadmap Generated:</strong> All topics successfully mapped within dependency constraints and daily limits.`;
            }
            
            realityBox.innerHTML = `<span>⚡</span><div>${realityText}</div>`;
            document.getElementById('results').style.display = 'block';
            document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        }
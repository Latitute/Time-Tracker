CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,        
  name VARCHAR(100) NOT NULL,               
  email VARCHAR(255) NOT NULL UNIQUE,       
  password_hash VARCHAR(255) NOT NULL,      
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP  
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,        
  user_id INT NOT NULL,                     
  title VARCHAR(255) NOT NULL,              
  description TEXT,  
  color VARCHAR(7) DEFAULT '#4361EE',                           
  category ENUM('STUDY', 'WORK', 'READING', 'SOCIAL', 'ENTERTAINMENT', 'EXERCISE', 'REST', 'OTHERS') DEFAULT 'STUDY',     
  is_active BOOLEAN DEFAULT TRUE,           
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE  
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,        
  user_id INT NOT NULL,                    
  task_id INT,                              
  start_time DATETIME NOT NULL,             
  end_time DATETIME NULL,                  
  duration INT DEFAULT 0,                   
  target_duration INT DEFAULT 0,            
  pause_count INT DEFAULT 0,                
  total_pause_time INT DEFAULT 0,           
  overtime_duration INT DEFAULT 0,          
  mood_after_task ENUM('EXHAUSTED', 'TIRED', 'NORMAL', 'ENERGIZED', 'HAPPY') DEFAULT 'NORMAL', 
  description TEXT,                        
  date DATE NOT NULL,                     
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,       
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL       
);
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,        
  user_id INT NOT NULL,                    
  task_id INT NOT NULL,                     
  scheduled_date DATE NOT NULL,             
  start_time TIME,                          
  estimated_duration INT DEFAULT 3600,      
  deadline DATETIME NULL,                   
  status ENUM('TODO', 'IN_PROGRESS', 'PENDING', 'DONE') DEFAULT 'TODO', 
  is_completed BOOLEAN DEFAULT FALSE,       
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,     
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE      
);

CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX idx_scheduled_user_date ON scheduled_tasks(user_id, scheduled_date);

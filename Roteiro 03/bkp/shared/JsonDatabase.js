const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class JsonDatabase {
  constructor(filePath, indexPath = null) {
    this.filePath = filePath;
    this.indexPath = indexPath;
    this.data = [];
    this.index = {};
    this.load();
  }

  load() {
    try {
      // Carrega dados principais
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.data = [];
        this.save();
      }

      // Carrega índice se especificado
      if (this.indexPath) {
        if (fs.existsSync(this.indexPath)) {
          const indexContent = fs.readFileSync(this.indexPath, 'utf8');
          this.index = JSON.parse(indexContent);
        } else {
          this.rebuildIndex();
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar database ${this.filePath}:`, error);
      this.data = [];
      this.index = {};
    }
  }

  save() {
    try {
      // Garante que o diretório existe
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Salva dados principais
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));

      // Salva índice se especificado
      if (this.indexPath) {
        fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
      }
    } catch (error) {
      console.error(`Erro ao salvar database ${this.filePath}:`, error);
    }
  }

  rebuildIndex() {
    this.index = {};
    this.data.forEach((item, idx) => {
      if (item.id) {
        this.index[item.id] = idx;
      }
    });
    if (this.indexPath) {
      this.save();
    }
  }

  // CREATE
  create(item) {
    const newItem = {
      id: uuidv4(),
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.data.push(newItem);
    
    if (this.indexPath) {
      this.index[newItem.id] = this.data.length - 1;
    }
    
    this.save();
    return newItem;
  }

  // READ
  findAll(filter = null) {
    if (!filter) return [...this.data];
    
    return this.data.filter(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  findById(id) {
    if (this.indexPath && this.index[id] !== undefined) {
      return this.data[this.index[id]] || null;
    }
    
    return this.data.find(item => item.id === id) || null;
  }

  findOne(filter) {
    return this.data.find(item => {
      for (const [key, value] of Object.entries(filter)) {
        if (item[key] !== value) return false;
      }
      return true;
    }) || null;
  }

  search(query, fields = ['name']) {
    const searchTerm = query.toLowerCase();
    return this.data.filter(item => {
      return fields.some(field => {
        const fieldValue = item[field];
        if (typeof fieldValue === 'string') {
          return fieldValue.toLowerCase().includes(searchTerm);
        }
        return false;
      });
    });
  }

  // UPDATE
  update(id, updates) {
    let itemIndex;
    
    if (this.indexPath && this.index[id] !== undefined) {
      itemIndex = this.index[id];
    } else {
      itemIndex = this.data.findIndex(item => item.id === id);
    }
    
    if (itemIndex === -1) return null;
    
    const updatedItem = {
      ...this.data[itemIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.data[itemIndex] = updatedItem;
    this.save();
    return updatedItem;
  }

  // DELETE
  delete(id) {
    let itemIndex;
    
    if (this.indexPath && this.index[id] !== undefined) {
      itemIndex = this.index[id];
    } else {
      itemIndex = this.data.findIndex(item => item.id === id);
    }
    
    if (itemIndex === -1) return false;
    
    const deletedItem = this.data[itemIndex];
    this.data.splice(itemIndex, 1);
    
    // Reconstrói índice após deleção
    if (this.indexPath) {
      this.rebuildIndex();
    }
    
    this.save();
    return deletedItem;
  }

  // UTILITY
  count(filter = null) {
    if (!filter) return this.data.length;
    return this.findAll(filter).length;
  }

  exists(id) {
    return this.findById(id) !== null;
  }

  clear() {
    this.data = [];
    this.index = {};
    this.save();
  }

  // AGGREGATION
  groupBy(field) {
    const groups = {};
    this.data.forEach(item => {
      const key = item[field] || 'undefined';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }

  countBy(field) {
    const groups = this.groupBy(field);
    const counts = {};
    for (const [key, items] of Object.entries(groups)) {
      counts[key] = items.length;
    }
    return counts;
  }
}

module.exports = JsonDatabase;
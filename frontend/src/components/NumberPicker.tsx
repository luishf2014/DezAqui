/**
 * Componente de seleção de números
 * FASE 2: Participações e Ranking
 * 
 * Volante numérico dinâmico para escolha de números em participações
 */
interface NumberPickerProps {
  min: number
  max: number
  maxSelected: number
  selectedNumbers: number[]
  onChange: (numbers: number[]) => void
}

export default function NumberPicker({
  min,
  max,
  maxSelected,
  selectedNumbers,
  onChange,
}: NumberPickerProps) {
  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)

  const toggleNumber = (number: number) => {
    if (selectedNumbers.includes(number)) {
      // Remove o número se já estiver selecionado
      onChange(selectedNumbers.filter((n) => n !== number))
    } else {
      // Adiciona o número se não exceder o limite
      if (selectedNumbers.length < maxSelected) {
        onChange([...selectedNumbers, number].sort((a, b) => a - b))
      }
    }
  }

  const generateRandom = () => {
    // CHATGPT: Surpresinha - gera números únicos aleatórios
    const available = numbers.filter((n) => !selectedNumbers.includes(n))
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const randomNumbers = shuffled.slice(0, maxSelected)
    onChange(randomNumbers.sort((a, b) => a - b))
  }

  const clearSelection = () => {
    onChange([])
  }

  return (
    <div className="space-y-4">
      {/* Contador e ações */}
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-gray-700">
          {selectedNumbers.length} de {maxSelected} selecionados
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateRandom}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm"
          >
            Surpresinha
          </button>
          {selectedNumbers.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Grid de números */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
        {numbers.map((number) => {
          const isSelected = selectedNumbers.includes(number)
          const isDisabled =
            !isSelected && selectedNumbers.length >= maxSelected

          return (
            <button
              key={number}
              type="button"
              onClick={() => toggleNumber(number)}
              disabled={isDisabled}
              className={`
                px-4 py-3 rounded-lg font-medium text-sm transition-all
                ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md scale-105'
                    : isDisabled
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                }
              `}
            >
              {number}
            </button>
          )
        })}
      </div>

      {/* Números selecionados */}
      {selectedNumbers.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Números selecionados:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedNumbers.map((number) => (
              <span
                key={number}
                className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium"
              >
                {number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

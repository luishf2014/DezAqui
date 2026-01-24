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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div className="text-sm font-semibold text-[#1F1F1F]">
          {selectedNumbers.length} de {maxSelected} selecionados
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={generateRandom}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#1E7F43] text-white rounded-xl hover:bg-[#3CCB7F] transition-colors text-sm font-semibold shadow-lg"
          >
            Surpresinha
          </button>
          {selectedNumbers.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="flex-1 sm:flex-none px-4 py-2 bg-[#E5E5E5] text-[#1F1F1F] rounded-xl hover:bg-[#E5E5E5]/80 transition-colors text-sm font-semibold"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Grid de números */}
      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
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
                px-2 py-2 sm:px-3 sm:py-2.5 md:px-4 md:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all
                ${
                  isSelected
                    ? 'bg-[#F4C430] text-[#1F1F1F] shadow-md scale-105'
                    : isDisabled
                    ? 'bg-[#F9F9F9] text-[#E5E5E5] cursor-not-allowed border border-[#E5E5E5]'
                    : 'bg-white text-[#1F1F1F] border-2 border-[#E5E5E5] hover:border-[#1E7F43] hover:bg-[#F9F9F9]'
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
        <div className="mt-4 p-4 bg-[#F9F9F9] rounded-xl border border-[#E5E5E5]">
          <p className="text-sm font-semibold text-[#1F1F1F] mb-2">
            Números selecionados:
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedNumbers.map((number) => (
              <span
                key={number}
                className="px-3 py-1 bg-[#F4C430] text-[#1F1F1F] rounded-full text-sm font-bold"
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

<?php
namespace App\Repository;

use App\Entity\Evaluation;
use App\Entity\Fen;
use App\Service\ChessHelper;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;

class EvaluationRepository extends ServiceEntityRepository
{
    private $_em;
    private ChessHelper $chessHelper;
    
    public function __construct(ManagerRegistry $registry, EntityManagerInterface $em, ChessHelper $chessHelper)
    {
        parent::__construct($registry, Evaluation::class);

        $this->_em = $em;
        $this->chessHelper = $chessHelper;
    }

    /**
     * Returns the top N Evaluations for a given FEN string.
     *
     * @param string $fenString The FEN string to look up
     * @param int $limit Maximum number of top evaluations to return (default 5)
     *
     * @return Evaluation[] Array of Evaluation entities, ordered by rank ascending
     */
    public function findTopEvaluationByFen(string $fenString, int $limit = 5): array
    {
        $fenEntity = $this->_em->getRepository(Fen::class)->findOneBy(['fen' => $fenString]);
        if (!$fenEntity) {
            // Get the FEN with the en passant replaced by a -
            $fenEntity = $this->_em->getRepository(Fen::class)->findOneBy(['fen' => $this->chessHelper->normalizeFenForEvaluation($fenString, true)]);
        }

        if (!$fenEntity) {
            return [];
        }

        return $this->createQueryBuilder('e')
            ->where('e.fen = :fen')
            ->setParameter('fen', $fenEntity)
            ->orderBy('e.rank', 'ASC') // top-ranked moves first
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }
}
